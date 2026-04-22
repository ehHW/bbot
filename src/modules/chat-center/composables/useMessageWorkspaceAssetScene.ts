import { message } from "ant-design-vue";
import { computed, ref, type ComputedRef } from "vue";
import type { FileEntryItem } from "@/api/upload";
import type { AssetPickerSelection } from "@/components/assets/assetPickerAdapter";
import { applyGroupInvitationApi } from "@/api/chat";
import {
    saveChatAttachmentToResourceApi,
} from "@/api/upload";
import type {
    ChatGroupInvitationPayload,
    ChatMessageAssetPayload,
    ChatMessageItem,
    ChatMessageRecordPayload,
} from "@/types/chat";
import {
    buildAssetPreviewFromChatMessageAssetPayload,
    canAssetPreviewImage,
    canAssetPreviewVideo,
    getAssetPreviewPrimaryUrl,
    getAssetPreviewSourceUrl as resolveAssetPreviewSourceUrl,
    getAssetPreviewStreamUrl as resolveAssetPreviewStreamUrl,
    isPreviewableAssetPreview,
} from "@/utils/assetPreview";
import { getErrorMessage } from "@/utils/error";
import { useGlobalAudioStore } from "@/stores/globalAudio";
import { trimText } from "@/validators/common";

type UseMessageWorkspaceAssetSceneOptions = {
    canCreateFolderInResource: ComputedRef<boolean>;
    canSaveChatAttachmentToResource: ComputedRef<boolean>;
    chatConversation: {
        loadConversations: () => Promise<void>;
        loadContactGroupConversations: () => Promise<void>;
        selectConversation: (conversationId: number) => Promise<void>;
    };
    getChatRecordPayload: (
        messageItem: ChatMessageItem,
    ) => ChatMessageRecordPayload | null;
    openChatRecordViewerFromMessage: (messageItem: ChatMessageItem) => void;
};

export function useMessageWorkspaceAssetScene(
    options: UseMessageWorkspaceAssetSceneOptions,
) {
    const globalAudioStore = useGlobalAudioStore();
    const assetPreviewOpen = ref(false);
    const previewingAssetMessage = ref<ChatMessageItem | null>(null);
    const groupInvitationModalOpen = ref(false);
    const activeInvitationMessage = ref<ChatMessageItem | null>(null);
    const groupInvitationApplying = ref(false);
    const saveAssetDialogOpen = ref(false);
    const saveAssetPendingMessage = ref<ChatMessageItem | null>(null);
    const saveAssetSaving = ref(false);

    const getAssetMessagePayload = (
        messageItem: ChatMessageItem,
    ): ChatMessageAssetPayload | null => {
        if (
            messageItem.message_type !== "image"
            && messageItem.message_type !== "file"
        ) {
            return null;
        }
        const payload = messageItem.payload as Partial<ChatMessageAssetPayload>;
        if (
            !payload
            || (!payload.asset_reference_id
                && !payload.source_asset_reference_id
                && !payload.url
                && !payload.local_upload_id)
        ) {
            return null;
        }
        return payload as ChatMessageAssetPayload;
    };

    const getAssetDisplayName = (messageItem: ChatMessageItem) =>
        getAssetPreview(messageItem)?.displayName || messageItem.content || "附件";

    const getAssetPreview = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        if (!payload) {
            return null;
        }
        return buildAssetPreviewFromChatMessageAssetPayload(payload, {
            fallbackDisplayName: messageItem.content || "附件",
            fallbackMediaType: messageItem.message_type,
        });
    };

    const isAssetMessage = (messageItem: ChatMessageItem) =>
        Boolean(getAssetMessagePayload(messageItem));

    const getAssetPreviewSourceUrl = (messageItem: ChatMessageItem) =>
        resolveAssetPreviewSourceUrl(getAssetPreview(messageItem));

    const getAssetPreviewStreamUrl = (messageItem: ChatMessageItem) =>
        resolveAssetPreviewStreamUrl(getAssetPreview(messageItem));

    const getAssetSubtitleTracks = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        return (
            payload?.subtitle_tracks
            || payload?.extra_metadata?.video_processing?.subtitle_tracks
            || []
        );
    };

    const canPreviewImage = (messageItem: ChatMessageItem) => {
        return canAssetPreviewImage(getAssetPreview(messageItem));
    };

    const canPreviewVideo = (messageItem: ChatMessageItem) => {
        return canAssetPreviewVideo(getAssetPreview(messageItem));
    };

    const getVideoPosterUrl = (messageItem: ChatMessageItem) => {
        return getAssetPreview(messageItem)?.thumbnailUrl || "";
    };

    const getAssetUploadProgress = (messageItem: ChatMessageItem) => {
        const progress = Number(
            getAssetMessagePayload(messageItem)?.upload_progress || 0,
        );
        return Math.min(100, Math.max(0, Math.round(progress)));
    };

    const isAssetUploading = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        return (
            messageItem.local_status === "sending"
            && payload?.upload_phase === "uploading"
        );
    };

    const showVideoPlayOverlay = (messageItem: ChatMessageItem) =>
        canPreviewVideo(messageItem) && !isAssetUploading(messageItem);

    const isAudioMessage = (messageItem: ChatMessageItem) => {
        const preview = getAssetPreview(messageItem);
        const mediaType = String(preview?.mediaType || "").toLowerCase();
        const mimeType = String(preview?.mimeType || "").toLowerCase();
        return mediaType === "audio" || mimeType.startsWith("audio/");
    };

    const formatDuration = (totalSeconds: number) => {
        const normalized = Math.max(0, Math.floor(Number(totalSeconds || 0)));
        const minutes = Math.floor(normalized / 60);
        const seconds = normalized % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    const getMessageTrackId = (messageItem: ChatMessageItem) => {
        const payload = getAssetMessagePayload(messageItem);
        return Number(
            payload?.asset_reference_id
            || payload?.source_asset_reference_id
            || messageItem.id,
        );
    };

    const getAudioDurationText = (messageItem: ChatMessageItem) => {
        const preview = getAssetPreview(messageItem);
        const totalSeconds = Number(preview?.durationSeconds || 0);
        if (totalSeconds <= 0) {
            return "";
        }
        const totalText = formatDuration(totalSeconds);
        const trackId = getMessageTrackId(messageItem);
        const isCurrentTrack = globalAudioStore.isCurrentTrack(trackId);
        const currentText = formatDuration(globalAudioStore.currentTime);
        if (isCurrentTrack && (globalAudioStore.isPlaying || globalAudioStore.currentTime > 0)) {
            return `${currentText}/${totalText}`;
        }
        return totalText;
    };

    const isAudioPlaying = (messageItem: ChatMessageItem) => {
        const trackId = getMessageTrackId(messageItem);
        return globalAudioStore.isCurrentTrack(trackId) && globalAudioStore.isPlaying;
    };

    const toggleAudioPlayback = (messageItem: ChatMessageItem) => {
        const preview = getAssetPreview(messageItem);
        const sourceUrl = getAssetPreviewPrimaryUrl(preview);
        if (!sourceUrl) {
            return;
        }
        const payload = getAssetMessagePayload(messageItem);
        const audioProcessing =
            (payload?.extra_metadata?.audio_processing || {}) as Record<
                string,
                unknown
            >;
        const trackId = getMessageTrackId(messageItem);
        if (globalAudioStore.isCurrentTrack(trackId)) {
            globalAudioStore.requestToggle();
            return;
        }
        globalAudioStore.requestPlayTrack({
            id: trackId,
            title: preview?.displayName || messageItem.content || "音频",
            coverUrl: String(audioProcessing["cover_url"] || "") || undefined,
            lrcUrl: String(audioProcessing["lyrics_url"] || "") || undefined,
            m4aUrl: sourceUrl,
        });
    };

    const getGroupInvitationPayload = (messageItem: ChatMessageItem) => {
        const payload = messageItem.payload as {
            group_invitation?: ChatGroupInvitationPayload;
        };
        return payload.group_invitation || null;
    };

    const activeGroupInvitation = computed(() =>
        activeInvitationMessage.value
            ? getGroupInvitationPayload(activeInvitationMessage.value)
            : null,
    );

    const assetPreviewTitle = computed(() =>
        previewingAssetMessage.value
            ? getAssetPreview(previewingAssetMessage.value)?.displayName
            || getAssetDisplayName(previewingAssetMessage.value)
            : "媒体预览",
    );

    const hasAssetPlaybackSource = (messageItem: ChatMessageItem) =>
        Boolean(getAssetPreviewPrimaryUrl(getAssetPreview(messageItem)));

    const hasMessageBubbleAction = (messageItem: ChatMessageItem) =>
        Boolean(
            getGroupInvitationPayload(messageItem)
            || hasAssetPlaybackSource(messageItem)
            || options.getChatRecordPayload(messageItem),
        );

    const isChatRecordMessage = (messageItem: ChatMessageItem) =>
        Boolean(options.getChatRecordPayload(messageItem));

    const isPreviewableAssetMessage = (messageItem: ChatMessageItem) => {
        return isPreviewableAssetPreview(getAssetPreview(messageItem));
    };

    const triggerAssetDownload = (messageItem: ChatMessageItem) => {
        const preview = getAssetPreview(messageItem);
        const url =
            getAssetPreviewSourceUrl(messageItem)
            || getAssetPreviewStreamUrl(messageItem);
        if (!url) {
            return;
        }
        const link = document.createElement("a");
        link.href = url;
        link.download = preview?.displayName || getAssetDisplayName(messageItem);
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const loadSaveAssetFolders = async (parentId?: number | null) => {
        // Obsolete
    };

    const openPreviewableAsset = (messageItem: ChatMessageItem) => {
        previewingAssetMessage.value = messageItem;
        assetPreviewOpen.value = true;
    };

    const openAssetMessage = (messageItem: ChatMessageItem) => {
        if (!hasAssetPlaybackSource(messageItem)) {
            return;
        }
        if (isAudioMessage(messageItem)) {
            toggleAudioPlayback(messageItem);
            return;
        }
        if (!isPreviewableAssetMessage(messageItem)) {
            triggerAssetDownload(messageItem);
            return;
        }
        openPreviewableAsset(messageItem);
    };

    const openGroupInvitationModal = (messageItem: ChatMessageItem) => {
        if (!getGroupInvitationPayload(messageItem)) {
            return;
        }
        activeInvitationMessage.value = messageItem;
        groupInvitationModalOpen.value = true;
    };

    const handleMessageBubbleClick = (messageItem: ChatMessageItem) => {
        if (getGroupInvitationPayload(messageItem)) {
            openGroupInvitationModal(messageItem);
            return;
        }
        if (options.getChatRecordPayload(messageItem)) {
            options.openChatRecordViewerFromMessage(messageItem);
            return;
        }
        openAssetMessage(messageItem);
    };

    const toggleSaveAssetFolderInline = () => {
        // Obsolete
    };

    const openSaveAssetBreadcrumb = async (id: number | null) => {
        // Obsolete
    };

    const enterSaveAssetFolder = async (folder: FileEntryItem) => {
        // Obsolete
    };

    const handleCreateSaveAssetFolder = async () => {
        // Obsolete
    };

    const openSaveAssetDialog = async (messageItem: ChatMessageItem) => {
        if (!options.canSaveChatAttachmentToResource.value) {
            message.warning("当前角色无保存聊天附件权限");
            return false;
        }
        if (!isAssetMessage(messageItem)) {
            return false;
        }
        saveAssetPendingMessage.value = messageItem;
        saveAssetDialogOpen.value = true;
        return true;
    };

    const confirmSaveAssetToResource = async (selection: AssetPickerSelection) => {
        if (!options.canSaveChatAttachmentToResource.value) {
            message.warning("当前角色无保存聊天附件权限");
            return;
        }
        if (selection.kind !== "folder") {
            return;
        }
        const currentMessage = saveAssetPendingMessage.value;
        if (!currentMessage) {
            saveAssetDialogOpen.value = false;
            return;
        }
        const payload = getAssetMessagePayload(currentMessage);
        const sourceAssetReferenceId = Number(
            payload?.asset_reference_id || payload?.source_asset_reference_id || 0,
        );
        if (!sourceAssetReferenceId) {
            message.warning("当前附件暂不支持保存到资源中心");
            return;
        }
        saveAssetSaving.value = true;
        try {
            await saveChatAttachmentToResourceApi({
                source_asset_reference_id: sourceAssetReferenceId,
                parent_id: selection.entryId,
                display_name:
                    payload?.display_name || currentMessage.content || undefined,
            });
            saveAssetDialogOpen.value = false;
            saveAssetPendingMessage.value = null;
            message.success("已保存到资源中心");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "保存附件失败"));
        } finally {
            saveAssetSaving.value = false;
        }
    };

    const handleApplyGroupInvitation = async () => {
        const invitation = activeGroupInvitation.value;
        if (!invitation) {
            return;
        }
        groupInvitationApplying.value = true;
        try {
            const { data } = await applyGroupInvitationApi({
                conversation_id: invitation.conversation_id,
                inviter_user_id: invitation.inviter.id,
            });
            await Promise.all([
                options.chatConversation.loadConversations(),
                options.chatConversation.loadContactGroupConversations(),
            ]);
            if (data.mode === "joined" && data.conversation?.id) {
                await options.chatConversation.selectConversation(data.conversation.id);
            }
            groupInvitationModalOpen.value = false;
            message.success(data.detail || "申请已提交");
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "申请入群失败"));
        } finally {
            groupInvitationApplying.value = false;
        }
    };

    return {
        assetPreviewOpen,
        previewingAssetMessage,
        groupInvitationModalOpen,
        groupInvitationApplying,
        saveAssetDialogOpen,
        saveAssetSaving,
        assetPreviewTitle,
        activeGroupInvitation,
        getAssetMessagePayload,
        getAssetPreview,
        getAssetPreviewSourceUrl,
        getAssetPreviewStreamUrl,
        getAssetSubtitleTracks,
        getAssetDisplayName,
        isAssetMessage,
        canPreviewImage,
        canPreviewVideo,
        getVideoPosterUrl,
        getAssetUploadProgress,
        isAssetUploading,
        showVideoPlayOverlay,
        isAudioMessage,
        isAudioPlaying,
        getAudioDurationText,
        getGroupInvitationPayload,
        isChatRecordMessage,
        hasMessageBubbleAction,
        openPreviewableAsset,
        openAssetMessage,
        openGroupInvitationModal,
        handleMessageBubbleClick,
        triggerAssetDownload,
        openSaveAssetDialog,
        confirmSaveAssetToResource,
        handleApplyGroupInvitation,
    };
}