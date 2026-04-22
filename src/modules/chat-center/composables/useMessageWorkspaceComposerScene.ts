import { message } from "ant-design-vue";
import { ref, type ComputedRef, type Ref } from "vue";
import type { AssetPickerSelection } from "@/components/assets/assetPickerAdapter";
import {
    buildComposerAttachmentToken,
    prepareChatComposerAssetFromSelection,
    prepareChatComposerAssetFromUploadResult,
} from "@/modules/chat-center/utils/chatAssetPrepare";
import type {
    ChatComposerAttachmentToken,
    ChatMessageItem,
    ChatMessageAssetPayload,
} from "@/types/chat";
import { getErrorMessage } from "@/utils/error";
import { uploadFileWithCategory } from "@/utils/fileUploader";
import type { RichMessageComposerExpose } from "@/views/Chat/components/RichMessageComposer.vue";

type UseMessageWorkspaceComposerSceneOptions = {
    authAccessToken: ComputedRef<string | undefined>;
    chatConversationState: {
        activeConversationId: number | null;
        activeConversation: {
            type: "direct" | "group";
            direct_target?: { id: number } | null;
        } | null;
    };
    chatMessage: {
        sendAttachmentMessage: (...args: any[]) => Promise<unknown>;
        sendTextMessage: (...args: any[]) => Promise<unknown>;
        sendTyping: (isTyping: boolean) => void;
    };
    composerBlockedReason: ComputedRef<string>;
    composerDisabled: ComputedRef<boolean>;
    canSendAttachment: ComputedRef<boolean>;
    isDirectFriend: ComputedRef<boolean>;
    quotedMessage: Ref<ChatMessageItem | null>;
};

export function useMessageWorkspaceComposerScene(
    options: UseMessageWorkspaceComposerSceneOptions,
) {
    const assetPickerOpen = ref(false);
    const composerRef = ref<RichMessageComposerExpose | null>(null);
    const attachmentInputRef = ref<HTMLInputElement | null>(null);
    const attachmentUploading = ref(false);
    const typingStopTimer = ref<number | null>(null);

    const getAttachmentSendGuardMessage = () => {
        const activeConversation = options.chatConversationState.activeConversation;
        if (options.composerBlockedReason.value) {
            return options.composerBlockedReason.value;
        }
        if (!options.canSendAttachment.value) {
            return "当前角色无发送附件权限";
        }
        if (activeConversation?.type === "direct" && !options.isDirectFriend.value) {
            return "你们还不是好友，当前私聊暂不支持发送附件";
        }
        return "";
    };

    const localFilesMap = new Map<string, File>();

    const insertAttachmentToken = (token: ChatComposerAttachmentToken) => {
        composerRef.value?.insertAttachment(token);
    };

    const prepareLocalFilesForComposer = async (files: File[]) => {
        if (!files.length) {
            return;
        }

        let successCount = 0;

        for (const file of files) {
            const localUploadId = `local_file_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            localFilesMap.set(localUploadId, file);

            const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
            const attachmentToken = buildComposerAttachmentToken({
                localUploadId,
                displayName: file.name,
                mediaType,
                mimeType: file.type,
                fileSize: file.size,
                url: URL.createObjectURL(file), // Provide a local object URL for preview
            });

            insertAttachmentToken(attachmentToken);
            successCount += 1;
        }

        if (successCount > 0) {
            message.success(
                successCount === 1
                    ? "附件已加入输入框"
                    : `已加入 ${successCount} 个附件`,
            );
        }
    };

    const handleComposerPasteFiles = async (files: File[]) => {
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage) {
            message.warning(guardMessage);
            return;
        }
        if (!files.length) {
            return;
        }
        await prepareLocalFilesForComposer(files);
    };

    const handleSendMessage = async () => {
        if (attachmentUploading.value) {
            message.warning("附件仍在准备中，请等待上传完成");
            return;
        }
        if (options.composerDisabled.value) {
            if (options.composerBlockedReason.value) {
                message.warning(options.composerBlockedReason.value);
            }
            return;
        }
        const segments = composerRef.value?.getSegments() || [];
        if (!segments.length) {
            message.warning("消息不能为空");
            return;
        }
        const quotedMessageId = options.quotedMessage.value?.id;
        try {
            const sendPromises: Promise<unknown>[] = [];
            for (const segment of segments) {
                if (segment.kind === "text") {
                    sendPromises.push(options.chatMessage.sendTextMessage(segment.text, quotedMessageId));
                    continue;
                }
                const sourceAssetReferenceId = Number(
                    segment.attachment.source_asset_reference_id || 0,
                );
                const localUploadId = segment.attachment.local_upload_id;

                if (!sourceAssetReferenceId && !localUploadId) {
                    throw new Error("附件尚未准备完成，请重新选择后再发送");
                }

                if (sourceAssetReferenceId) {
                    sendPromises.push(options.chatMessage.sendAttachmentMessage({
                        sourceAssetReferenceId,
                        displayName: segment.attachment.display_name,
                        mediaType: segment.attachment.media_type,
                        mimeType: segment.attachment.mime_type,
                        fileSize: segment.attachment.file_size,
                        url: segment.attachment.url,
                        streamUrl: segment.attachment.stream_url,
                        thumbnailUrl: segment.attachment.thumbnail_url,
                        processingStatus: segment.attachment.processing_status,
                        quotedMessageId,
                    }));
                } else if (localUploadId) {
                    const file = localFilesMap.get(localUploadId);
                    if (!file) throw new Error("无法读取本地文件");
                    if (!options.authAccessToken.value) throw new Error("会话无效，无法上传");

                    sendPromises.push(options.chatMessage.sendAttachmentMessage({
                        displayName: file.name,
                        mediaType: segment.attachment.media_type,
                        mimeType: file.type,
                        fileSize: file.size,
                        url: segment.attachment.url, // Object URL
                        quotedMessageId,
                        uploadBeforeSend: async (updateProgress: (payloadPatch: Partial<ChatMessageAssetPayload>) => void) => {
                            const result = await uploadFileWithCategory({
                                file,
                                category: "chat",
                                token: options.authAccessToken.value!,
                                onChunkProgress: (progress) => {
                                    updateProgress({ upload_progress: progress });
                                }
                            });
                            const prepared = prepareChatComposerAssetFromUploadResult(result);
                            return {
                                sourceAssetReferenceId: prepared.attachmentToken.source_asset_reference_id!,
                                displayName: prepared.attachmentToken.display_name,
                                mediaType: prepared.attachmentToken.media_type,
                                mimeType: prepared.attachmentToken.mime_type,
                                fileSize: prepared.attachmentToken.file_size,
                                url: prepared.attachmentToken.url,
                                streamUrl: prepared.attachmentToken.stream_url,
                                thumbnailUrl: prepared.attachmentToken.thumbnail_url,
                                processingStatus: prepared.attachmentToken.processing_status,
                            };
                        }
                    }));
                }
            }
            composerRef.value?.clear();
            options.quotedMessage.value = null;
            await Promise.all(sendPromises);
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "发送消息失败"));
        } finally {
            options.chatMessage.sendTyping(false);
        }
    };

    const triggerAttachmentSelect = () => {
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage || attachmentUploading.value) {
            if (guardMessage) {
                message.warning(guardMessage);
            } else if (attachmentUploading.value) {
                message.warning("附件仍在准备中，请等待上传完成");
            }
            return;
        }
        attachmentInputRef.value?.click();
    };

    const openResourceAttachmentPicker = async () => {
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage) {
            message.warning(guardMessage);
            return;
        }
        if (attachmentUploading.value) {
            message.warning("附件仍在准备中，请等待上传完成");
            return;
        }
        if (!options.chatConversationState.activeConversationId) {
            message.warning("请先选择会话");
            return;
        }
        assetPickerOpen.value = true;
    };

    const handleAssetPickerSelect = async (selection: AssetPickerSelection) => {
        try {
            const preparedAsset = prepareChatComposerAssetFromSelection(selection);
            insertAttachmentToken(preparedAsset.attachmentToken);
            message.success("附件已加入输入框");
        } catch (error: unknown) {
            assetPickerOpen.value = true;
            message.error(getErrorMessage(error, "加入附件失败"));
        }
    };

    const handleComposerMenuClick = ({ key }: { key: string }) => {
        if (key === "attachment") {
            triggerAttachmentSelect();
            return;
        }
        if (key === "asset-picker") {
            void openResourceAttachmentPicker();
        }
    };

    const handleAttachmentSelection = async (event: Event) => {
        const input = event.target as HTMLInputElement | null;
        const files = Array.from(input?.files || []);
        if (input) {
            input.value = "";
        }
        if (!files.length) {
            return;
        }
        const guardMessage = getAttachmentSendGuardMessage();
        if (guardMessage) {
            message.warning(guardMessage);
            return;
        }
        await prepareLocalFilesForComposer(files);
    };

    const stopTypingSoon = () => {
        if (typingStopTimer.value) {
            window.clearTimeout(typingStopTimer.value);
        }
        typingStopTimer.value = window.setTimeout(() => {
            options.chatMessage.sendTyping(false);
        }, 1200);
    };

    const handleComposerTypingChange = (hasContent: boolean) => {
        if (options.chatConversationState.activeConversation?.type !== "direct") {
            return;
        }
        options.chatMessage.sendTyping(hasContent);
        stopTypingSoon();
    };

    const disposeComposerScene = () => {
        if (typingStopTimer.value) {
            window.clearTimeout(typingStopTimer.value);
        }
    };

    return {
        assetPickerOpen,
        composerRef,
        attachmentInputRef,
        attachmentUploading,
        insertAttachmentToken,
        handleComposerPasteFiles,
        handleSendMessage,
        triggerAttachmentSelect,
        openResourceAttachmentPicker,
        handleAssetPickerSelect,
        handleComposerMenuClick,
        handleAttachmentSelection,
        handleComposerTypingChange,
        disposeComposerScene,
    };
}