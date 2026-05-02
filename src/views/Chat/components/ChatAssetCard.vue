<template>
    <div
        class="chat-asset-card"
        :class="{
            'chat-asset-card--media': !expired && hasMediaPreview,
            'chat-asset-card--media-meta': !expired && hasMediaPreview && showMediaMeta,
            'chat-asset-card--audio': !expired && isAudioCard,
            'chat-asset-card--expired': expired,
        }"
    >
        <!-- 文件已过期气泡 -->
        <div v-if="expired" class="chat-asset-card__body chat-asset-card__body--expired">
            <span class="chat-asset-card__icon chat-asset-card__icon--expired">
                <WarningFilled />
            </span>
            <div class="chat-asset-card__meta">
                <span class="chat-asset-card__name">{{
                    resolvedPreview.displayName || "附件"
                }}</span>
                <span class="chat-asset-card__size chat-asset-card__size--expired">文件已过期</span>
            </div>
        </div>

        <div v-else-if="isAudioCard" class="chat-asset-card__audio-row">
            <span class="chat-asset-card__audio-control">
                <span
                    v-if="uploading"
                    class="chat-asset-card__progress-ring chat-asset-card__progress-ring--inline"
                >
                    {{ normalizedUploadProgress }}%
                </span>
                <span
                    v-else
                    class="chat-asset-card__play-indicator chat-asset-card__play-indicator--inline"
                >
                    <PauseCircleFilled v-if="playing" />
                    <CaretRightFilled v-else />
                </span>
            </span>
            <div class="chat-asset-card__meta chat-asset-card__meta--audio">
                <span class="chat-asset-card__name">{{
                    resolvedPreview.displayName
                }}</span>
                <span class="chat-asset-card__size">{{
                    audioDurationText || fileSizeLabel
                }}</span>
            </div>
        </div>        <div
            v-else-if="hasMediaPreview"
            class="chat-asset-card__media-shell"
            :style="mediaBoxStyle"
        >
            <img
                v-if="isImagePreview"
                :src="resolvedPreview.url"
                :alt="resolvedPreview.displayName"
                class="chat-asset-card__preview"
                loading="lazy"
                decoding="async"
            />
            <VideoAttachmentThumbnail
                v-else
                :poster-url="resolvedPreview.thumbnailUrl || ''"
                :source-url="previewSourceUrl"
                :alt="resolvedPreview.displayName"
                class="chat-asset-card__preview chat-asset-card__preview--video"
            />
            <div v-if="uploading" class="chat-asset-card__overlay">
                <div class="chat-asset-card__progress-ring">
                    {{ normalizedUploadProgress }}%
                </div>
            </div>
            <div
                v-else-if="showPlayableOverlay"
                class="chat-asset-card__overlay"
                aria-hidden="true"
            >
                <span class="chat-asset-card__play-indicator">
                    <CaretRightFilled />
                </span>
            </div>
        </div>        <div
            v-if="(!hasMediaPreview || showMediaMeta) && !isAudioCard"
            class="chat-asset-card__body"
        >
            <span v-if="!hasMediaPreview" class="chat-asset-card__icon">
                <FileOutlined />
            </span>
            <div class="chat-asset-card__meta">
                <span class="chat-asset-card__name">{{
                    resolvedPreview.displayName
                }}</span>
                <span class="chat-asset-card__size">{{ fileSizeLabel }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    CaretRightFilled,
    FileOutlined,
    PauseCircleFilled,
    WarningFilled,
} from "@ant-design/icons-vue";
import { computed } from "vue";
import type { AssetPreviewModel } from "@/types/assets";
import {
    canAssetPreviewImage,
    canAssetPreviewVideo,
    formatAssetPreviewFileSize,
    getAssetPreviewPrimaryUrl,
} from "@/utils/assetPreview";
import VideoAttachmentThumbnail from "@/views/Chat/components/VideoAttachmentThumbnail.vue";

const props = withDefaults(
    defineProps<{
        preview: AssetPreviewModel | null;
        showMediaMeta?: boolean;
        showPlayableOverlay?: boolean;
        uploading?: boolean;
        uploadProgress?: number;
        playing?: boolean;
        audioDurationText?: string;
        expired?: boolean;
    }>(),
    {
        showMediaMeta: false,
        showPlayableOverlay: false,
        uploading: false,
        uploadProgress: 0,
        playing: false,
        audioDurationText: "",
        expired: false,
    },
);

const resolvedPreview = computed<AssetPreviewModel>(
    () =>
        props.preview || {
            displayName: "附件",
            mediaType: "file",
            mimeType: undefined,
            fileSize: undefined,
            url: undefined,
            streamUrl: undefined,
            thumbnailUrl: undefined,
            processingStatus: undefined,
            width: undefined,
            height: undefined,
            durationSeconds: undefined,
            isDirectory: false,
            isVirtual: false,
        },
);

const isImagePreview = computed(() =>
    canAssetPreviewImage(resolvedPreview.value),
);

const isVideoPreview = computed(() =>
    canAssetPreviewVideo(resolvedPreview.value),
);

const hasMediaPreview = computed(
    () => isImagePreview.value || isVideoPreview.value,
);

const isAudioCard = computed(() => {
    const mediaType = String(
        resolvedPreview.value.mediaType || "",
    ).toLowerCase();
    const mimeType = String(resolvedPreview.value.mimeType || "").toLowerCase();
    return mediaType === "audio" || mimeType.startsWith("audio/");
});

const previewSourceUrl = computed(() =>
    getAssetPreviewPrimaryUrl(resolvedPreview.value),
);

const mediaBoxStyle = computed(() => {
    const width = Number(resolvedPreview.value.width || 0);
    const height = Number(resolvedPreview.value.height || 0);
    if (!width || !height) {
        return undefined;
    }
    const scale = Math.min(320 / width, 220 / height, 1);
    return {
        "--attachment-preview-width": `${Math.round(width * scale)}px`,
        "--attachment-preview-height": `${Math.round(height * scale)}px`,
    };
});

const normalizedUploadProgress = computed(() =>
    Math.min(100, Math.max(0, Math.round(Number(props.uploadProgress || 0)))),
);

const fileSizeLabel = computed(() =>
    formatAssetPreviewFileSize(resolvedPreview.value),
);
</script>

<style scoped>
.chat-asset-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
}

.chat-asset-card--media {
    gap: 0;
}

.chat-asset-card--media-meta {
    gap: 10px;
}

.chat-asset-card__media-shell {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 140px;
    min-height: 96px;
    max-width: min(var(--attachment-preview-width, 320px), 80vw);
    max-height: var(--attachment-preview-height, 220px);
    margin: 0 auto;
    overflow: hidden;
    border-radius: 14px;
    background: #f3f4f6;
}

.chat-asset-card__preview {
    display: block;
    width: auto;
    height: auto;
    max-width: min(var(--attachment-preview-width, 320px), 80vw);
    max-height: var(--attachment-preview-height, 220px);
    border-radius: 14px;
    object-fit: contain;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
    background: #f3f4f6;
}

.chat-asset-card__preview--video {
    background: #111827;
}

.chat-asset-card__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.28);
}

.chat-asset-card__progress-ring,
.chat-asset-card__play-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.96);
    background: rgba(15, 23, 42, 0.4);
    color: #ffffff;
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
}

.chat-asset-card__play-indicator :deep(svg) {
    font-size: 28px;
    transform: translateX(2px);
}

.chat-asset-card__play-indicator--inline {
    width: 34px;
    height: 34px;
    font-size: 16px;
}

.chat-asset-card__play-indicator--inline :deep(svg) {
    font-size: 18px;
    transform: translateX(1px);
}

.chat-asset-card__progress-ring--inline {
    width: 34px;
    height: 34px;
    font-size: 12px;
}

.chat-asset-card__audio-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 220px;
    max-width: 220px;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    box-sizing: border-box;
}

.chat-asset-card__audio-control {
    display: inline-flex;
    flex: 0 0 auto;
}

.chat-asset-card__meta--audio {
    gap: 2px;
}

.chat-asset-card__body {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 220px;
    max-width: 220px;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    box-sizing: border-box;
}

.chat-asset-card__meta {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
}

.chat-asset-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    border-radius: 12px;
    background: rgba(47, 57, 69, 0.1);
    font-size: 20px;
}

.chat-asset-card__name {
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: normal;
}

.chat-asset-card__size {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-asset-card__body--expired {
    opacity: 0.72;
    cursor: not-allowed;
}

.chat-asset-card__icon--expired {
    background: rgba(234, 88, 12, 0.12);
    color: #ea580c;
}

.chat-asset-card__size--expired {
    color: #ea580c;
    font-weight: 500;
}
</style>
