import { message } from "ant-design-vue";
import { ref, type ComputedRef, type Ref } from "vue";
import type { AssetPickerSelection } from "@/components/assets/assetPickerAdapter";
import {
    prepareChatComposerAssetFromSelection,
    prepareChatComposerAssetFromUploadResult,
} from "@/modules/chat-center/utils/chatAssetPrepare";
import type {
    ChatComposerAttachmentToken,
    ChatMessageItem,
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

    const insertAttachmentToken = (token: ChatComposerAttachmentToken) => {
        composerRef.value?.insertAttachment(token);
    };

    const uploadFilesToPreparedAssets = async (files: File[]) => {
        if (!files.length) {
            return;
        }
        if (!options.authAccessToken.value) {
            message.error("登录状态无效，无法准备附件");
            return;
        }

        attachmentUploading.value = true;
        let successCount = 0;
        let failedCount = 0;
        let firstError: unknown = null;

        try {
            for (const file of files) {
                try {
                    const result = await uploadFileWithCategory({
                        file,
                        category: "chat",
                        token: options.authAccessToken.value,
                    });
                    const preparedAsset =
                        prepareChatComposerAssetFromUploadResult(result);
                    insertAttachmentToken(preparedAsset.attachmentToken);
                    successCount += 1;
                } catch (error: unknown) {
                    failedCount += 1;
                    if (!firstError) {
                        firstError = error;
                    }
                }
            }
        } finally {
            attachmentUploading.value = false;
        }

        if (failedCount === 0) {
            message.success(
                successCount === 1
                    ? "附件已加入输入框"
                    : `已加入 ${successCount} 个附件`,
            );
            return;
        }

        const baseMessage =
            successCount > 0
                ? `已加入 ${successCount} 个附件，另有 ${failedCount} 个准备失败`
                : "准备附件失败";
        message.error(getErrorMessage(firstError, baseMessage));
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
        await uploadFilesToPreparedAssets(files);
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
            for (const segment of segments) {
                if (segment.kind === "text") {
                    await options.chatMessage.sendTextMessage(segment.text, quotedMessageId);
                    continue;
                }
                const sourceAssetReferenceId = Number(
                    segment.attachment.source_asset_reference_id || 0,
                );
                if (!sourceAssetReferenceId) {
                    throw new Error("附件尚未准备完成，请重新选择后再发送");
                }
                await options.chatMessage.sendAttachmentMessage({
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
                });
            }
            composerRef.value?.clear();
            options.quotedMessage.value = null;
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
        await uploadFilesToPreparedAssets(files);
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