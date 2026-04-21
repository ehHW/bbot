import type { AssetPickerSelection } from "@/components/assets/assetPickerAdapter";
import type { AssetPreviewModel } from "@/types/assets";
import type {
    ChatComposerAttachmentToken,
    ChatMessageAssetPayload,
    ChatMessageRecordItem,
    ChatVideoSubtitleTrack,
} from "@/types/chat";
import {
    buildAssetPreviewFromChatComposerAttachmentToken,
    buildAssetPreviewFromChatMessageAssetPayload,
    normalizeAssetPreviewModel,
} from "@/utils/assetPreview";
import { formatFileSize } from "@/utils/fileFormatter";
import {
    buildAttachmentSendPayloadFromSelection,
    buildAttachmentSendPayloadFromUploadResult,
    type ChatAttachmentSendPayload,
} from "@/utils/chatAttachment";
import type { UploadFileResult } from "@/utils/fileUploader";

export type PreparedChatComposerAsset = {
    preview: AssetPreviewModel;
    sendPayload: ChatAttachmentSendPayload;
    attachmentToken: ChatComposerAttachmentToken;
};

export type PreparedChatComposerAssetClipboardData = {
    text: string;
    html: string;
};

const buildDefaultAttachmentTokenId = () =>
    `composer_attachment_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

function escapeHtml(value: string) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function buildComposerAttachmentPreviewHtml(preview: AssetPreviewModel) {
    const mediaType = String(preview.mediaType || "").toLowerCase();
    if (mediaType === "image" && preview.url) {
        return `<img class="composer-attachment-chip__preview" src="${escapeHtml(preview.url)}" alt="${escapeHtml(preview.displayName)}" />`;
    }
    if (mediaType === "video" && (preview.url || preview.streamUrl)) {
        const poster = preview.thumbnailUrl
            ? ` poster="${escapeHtml(preview.thumbnailUrl)}"`
            : "";
        return `<video class="composer-attachment-chip__preview" src="${escapeHtml(preview.url || preview.streamUrl || "")}"${poster} muted playsinline preload="metadata"></video>`;
    }
    return `<span class="composer-attachment-chip__icon">${mediaType === "video" ? "V" : "F"}</span>`;
}

function buildComposerAttachmentChipInnerHtml(preview: AssetPreviewModel) {
    const fileSizeText = preview.fileSize
        ? formatFileSize(preview.fileSize)
        : "大小未知";
    return `
        ${buildComposerAttachmentPreviewHtml(preview)}
        <span class="composer-attachment-chip__body">
            <span class="composer-attachment-chip__name">${escapeHtml(preview.displayName)}</span>
            <span class="composer-attachment-chip__size">${escapeHtml(fileSizeText)}</span>
        </span>
    `;
}

function buildComposerAttachmentTokenFromPreview(
    preview: AssetPreviewModel,
    options?: {
        tokenId?: string;
        sourceAssetReferenceId?: number;
        subtitleTracks?: ChatVideoSubtitleTrack[];
        localUploadId?: string;
    },
): ChatComposerAttachmentToken {
    return {
        token_id: options?.tokenId || buildDefaultAttachmentTokenId(),
        source_asset_reference_id: options?.sourceAssetReferenceId,
        display_name: preview.displayName,
        media_type: preview.mediaType,
        mime_type: preview.mimeType || "",
        file_size: preview.fileSize,
        url: preview.url || "",
        stream_url: preview.streamUrl || "",
        thumbnail_url: preview.thumbnailUrl || "",
        processing_status: preview.processingStatus || "",
        subtitle_tracks: options?.subtitleTracks,
        local_upload_id: options?.localUploadId,
    };
}

export function buildComposerAttachmentToken(options: {
    tokenId?: string;
    sourceAssetReferenceId?: number;
    displayName: string;
    mediaType: string;
    mimeType?: string;
    fileSize?: number;
    url?: string;
    streamUrl?: string;
    thumbnailUrl?: string;
    processingStatus?: string;
    subtitleTracks?: ChatVideoSubtitleTrack[];
    localUploadId?: string;
}): ChatComposerAttachmentToken {
    const preview = normalizeAssetPreviewModel({
        displayName: options.displayName,
        mediaType: options.mediaType,
        mimeType: options.mimeType,
        fileSize: options.fileSize,
        url: options.url,
        streamUrl: options.streamUrl,
        thumbnailUrl: options.thumbnailUrl,
        processingStatus: options.processingStatus,
    });
    return buildComposerAttachmentTokenFromPreview(preview, {
        tokenId: options.tokenId,
        sourceAssetReferenceId: options.sourceAssetReferenceId,
        subtitleTracks: options.subtitleTracks,
        localUploadId: options.localUploadId,
    });
}

export function normalizeComposerAttachmentToken(
    token: Partial<ChatComposerAttachmentToken>,
    options?: {
        tokenId?: string;
        sourceAssetReferenceId?: number;
        fallbackDisplayName?: string;
        fallbackMediaType?: string;
        localUploadId?: string;
    },
): ChatComposerAttachmentToken | null {
    const sourceAssetReferenceId = Number(
        options?.sourceAssetReferenceId || token.source_asset_reference_id || 0,
    ) || undefined;
    const localUploadId =
        String(options?.localUploadId || token.local_upload_id || "").trim()
        || undefined;

    if (!sourceAssetReferenceId && !localUploadId) {
        return null;
    }

    const preview = buildAssetPreviewFromChatComposerAttachmentToken(token, {
        fallbackDisplayName: options?.fallbackDisplayName,
        fallbackMediaType: options?.fallbackMediaType,
    });

    return buildComposerAttachmentTokenFromPreview(preview, {
        tokenId: options?.tokenId || token.token_id,
        sourceAssetReferenceId,
        subtitleTracks: token.subtitle_tracks,
        localUploadId,
    });
}

export function applyComposerAttachmentTokenToElement(
    element: HTMLElement,
    attachment: ChatComposerAttachmentToken,
) {
    const normalizedAttachment = normalizeComposerAttachmentToken(attachment);
    if (!normalizedAttachment) {
        return false;
    }

    const preview = buildAssetPreviewFromChatComposerAttachmentToken(
        normalizedAttachment,
    );
    element.className = "composer-attachment-chip";
    element.setAttribute("contenteditable", "false");
    element.dataset.solbotAttachment = "1";
    element.dataset.tokenId = normalizedAttachment.token_id;
    element.dataset.sourceAssetReferenceId = String(
        normalizedAttachment.source_asset_reference_id || "",
    );
    element.dataset.displayName = normalizedAttachment.display_name;
    element.dataset.mediaType = normalizedAttachment.media_type;
    element.dataset.mimeType = normalizedAttachment.mime_type || "";
    element.dataset.fileSize = String(normalizedAttachment.file_size || "");
    element.dataset.url = normalizedAttachment.url || "";
    element.dataset.streamUrl = normalizedAttachment.stream_url || "";
    element.dataset.thumbnailUrl = normalizedAttachment.thumbnail_url || "";
    element.dataset.processingStatus =
        normalizedAttachment.processing_status || "";
    element.dataset.localUploadId = normalizedAttachment.local_upload_id || "";
    element.innerHTML = buildComposerAttachmentChipInnerHtml(preview);
    return true;
}

export function createComposerAttachmentChipElement(
    attachment: ChatComposerAttachmentToken,
) {
    const chip = document.createElement("span");
    applyComposerAttachmentTokenToElement(chip, attachment);
    return chip;
}

export function buildComposerAttachmentClipboardHtml(
    attachment: ChatComposerAttachmentToken,
) {
    const normalizedAttachment = normalizeComposerAttachmentToken(attachment);
    if (!normalizedAttachment) {
        return "";
    }
    return `<span class="composer-attachment-chip" contenteditable="false" data-solbot-attachment="1" data-token-id="${escapeHtml(normalizedAttachment.token_id)}" data-source-asset-reference-id="${escapeHtml(String(normalizedAttachment.source_asset_reference_id || ""))}" data-display-name="${escapeHtml(normalizedAttachment.display_name)}" data-media-type="${escapeHtml(normalizedAttachment.media_type)}" data-mime-type="${escapeHtml(normalizedAttachment.mime_type || "")}" data-file-size="${escapeHtml(String(normalizedAttachment.file_size || ""))}" data-url="${escapeHtml(normalizedAttachment.url || "")}" data-stream-url="${escapeHtml(normalizedAttachment.stream_url || "")}" data-thumbnail-url="${escapeHtml(normalizedAttachment.thumbnail_url || "")}" data-processing-status="${escapeHtml(normalizedAttachment.processing_status || "")}" data-local-upload-id="${escapeHtml(normalizedAttachment.local_upload_id || "")}">${buildComposerAttachmentChipInnerHtml(buildAssetPreviewFromChatComposerAttachmentToken(normalizedAttachment))}</span>`;
}

export function buildPreparedChatComposerAssetClipboardData(
    prepared: PreparedChatComposerAsset | null,
): PreparedChatComposerAssetClipboardData | null {
    if (!prepared) {
        return null;
    }

    return {
        text: [
            prepared.preview.displayName,
            prepared.preview.url || prepared.preview.streamUrl || "",
        ]
            .filter(Boolean)
            .join("\n"),
        html: buildComposerAttachmentClipboardHtml(prepared.attachmentToken),
    };
}

export function readComposerAttachmentTokenFromElement(
    element: HTMLElement,
): ChatComposerAttachmentToken | null {
    if (element.dataset.solbotAttachment !== "1") {
        return null;
    }
    return normalizeComposerAttachmentToken({
        token_id: element.dataset.tokenId || undefined,
        source_asset_reference_id:
            Number(element.dataset.sourceAssetReferenceId || 0) || undefined,
        display_name: element.dataset.displayName || undefined,
        media_type: element.dataset.mediaType || undefined,
        mime_type: element.dataset.mimeType || undefined,
        file_size: Number(element.dataset.fileSize || 0) || undefined,
        url: element.dataset.url || undefined,
        stream_url: element.dataset.streamUrl || undefined,
        thumbnail_url: element.dataset.thumbnailUrl || undefined,
        processing_status: element.dataset.processingStatus || undefined,
        local_upload_id: element.dataset.localUploadId || undefined,
    });
}

export function buildComposerAttachmentTokenFromSendPayload(
    payload: ChatAttachmentSendPayload,
    options?: {
        tokenId?: string;
        subtitleTracks?: ChatVideoSubtitleTrack[];
        localUploadId?: string;
    },
): ChatComposerAttachmentToken {
    const preview = normalizeAssetPreviewModel(payload);
    return buildComposerAttachmentTokenFromPreview(preview, {
        tokenId: options?.tokenId,
        sourceAssetReferenceId: payload.sourceAssetReferenceId,
        subtitleTracks: options?.subtitleTracks,
        localUploadId: options?.localUploadId,
    });
}

export function prepareChatComposerAssetFromSelection(
    selection: AssetPickerSelection,
    options?: {
        tokenId?: string;
    },
): PreparedChatComposerAsset {
    const sendPayload = buildAttachmentSendPayloadFromSelection(selection);
    const preview = selection.preview;
    return {
        preview,
        sendPayload,
        attachmentToken: buildComposerAttachmentTokenFromPreview(preview, {
            tokenId: options?.tokenId,
            sourceAssetReferenceId: sendPayload.sourceAssetReferenceId,
        }),
    };
}

export function prepareChatComposerAssetFromUploadResult(
    result: Pick<UploadFileResult, "selection" | "preview">,
    options?: {
        tokenId?: string;
    },
): PreparedChatComposerAsset {
    const sendPayload = buildAttachmentSendPayloadFromUploadResult(result);
    const preview = result.preview || result.selection.preview;
    return {
        preview,
        sendPayload,
        attachmentToken: buildComposerAttachmentTokenFromPreview(preview, {
            tokenId: options?.tokenId,
            sourceAssetReferenceId: sendPayload.sourceAssetReferenceId,
        }),
    };
}

export function prepareChatComposerAssetFromMessageAssetPayload(
    payload: Partial<ChatMessageAssetPayload>,
    options?: {
        tokenId?: string;
        fallbackDisplayName?: string;
        fallbackMediaType?: string;
    },
): PreparedChatComposerAsset | null {
    const sourceAssetReferenceId = Number(
        payload.source_asset_reference_id || payload.asset_reference_id || 0,
    );
    if (!sourceAssetReferenceId) {
        return null;
    }

    const preview = buildAssetPreviewFromChatMessageAssetPayload(payload, {
        fallbackDisplayName: options?.fallbackDisplayName,
        fallbackMediaType: options?.fallbackMediaType,
    });
    const sendPayload: ChatAttachmentSendPayload = {
        sourceAssetReferenceId,
        displayName: preview.displayName,
        mediaType: preview.mediaType,
        mimeType: preview.mimeType,
        fileSize: preview.fileSize,
        url: preview.url,
        streamUrl: preview.streamUrl,
        thumbnailUrl: preview.thumbnailUrl,
        processingStatus: preview.processingStatus,
    };

    return {
        preview,
        sendPayload,
        attachmentToken: buildComposerAttachmentTokenFromPreview(preview, {
            tokenId: options?.tokenId,
            sourceAssetReferenceId,
            subtitleTracks: payload.subtitle_tracks,
        }),
    };
}

export function prepareChatComposerAssetFromRecordEntry(
    entry: ChatMessageRecordItem,
    options?: {
        tokenId?: string;
    },
): PreparedChatComposerAsset | null {
    if (!entry.asset) {
        return null;
    }
    return prepareChatComposerAssetFromMessageAssetPayload(entry.asset, {
        tokenId: options?.tokenId,
        fallbackDisplayName: entry.content || entry.asset.display_name || "附件",
        fallbackMediaType: entry.message_type,
    });
}

export function buildChatComposerAssetClipboardDataFromMessageAssetPayload(
    payload: Partial<ChatMessageAssetPayload>,
    options?: {
        tokenId?: string;
        fallbackDisplayName?: string;
        fallbackMediaType?: string;
    },
) {
    return buildPreparedChatComposerAssetClipboardData(
        prepareChatComposerAssetFromMessageAssetPayload(payload, options),
    );
}

export function buildChatComposerAssetClipboardDataFromRecordEntry(
    entry: ChatMessageRecordItem,
    options?: {
        tokenId?: string;
    },
) {
    return buildPreparedChatComposerAssetClipboardData(
        prepareChatComposerAssetFromRecordEntry(entry, options),
    );
}