import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import type { AssetPreviewModel } from '@/types/assets'
import type { ChatComposerAttachmentToken, ChatMessageAssetPayload } from '@/types/chat'

type ResourceEntryLike = FileEntryItem | SearchFileEntryItem

type AssetPreviewInput = {
    displayName?: unknown
    mediaType?: unknown
    mimeType?: unknown
    fileSize?: unknown
    url?: unknown
    streamUrl?: unknown
    thumbnailUrl?: unknown
    processingStatus?: unknown
    width?: unknown
    height?: unknown
    durationSeconds?: unknown
    isDirectory?: unknown
    isVirtual?: unknown
}

const normalizeText = (value: unknown) => {
    const normalized = String(value || '').trim()
    return normalized || undefined
}

const normalizePositiveNumber = (value: unknown) => {
    const normalized = Number(value)
    return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined
}

const resolveVideoProcessingMetadata = (value: unknown) => {
    if (!value || typeof value !== 'object') {
        return null
    }
    return value as Record<string, unknown>
}

export function inferAssetPreviewMediaType(options: {
    mediaType?: unknown
    mimeType?: unknown
    isDirectory?: unknown
    isVirtual?: unknown
}) {
    if (options.isDirectory) {
        return options.isVirtual ? 'virtual_directory' : 'directory'
    }

    const normalizedMediaType = normalizeText(options.mediaType)?.toLowerCase()
    if (normalizedMediaType === 'avatar') {
        return 'image'
    }
    if (normalizedMediaType) {
        return normalizedMediaType
    }

    const normalizedMimeType = normalizeText(options.mimeType)?.toLowerCase() || ''
    if (normalizedMimeType.startsWith('image/')) {
        return 'image'
    }
    if (normalizedMimeType.startsWith('video/')) {
        return 'video'
    }
    if (normalizedMimeType.startsWith('audio/')) {
        return 'audio'
    }
    return 'file'
}

export function normalizeAssetPreviewModel(input: AssetPreviewInput): AssetPreviewModel {
    const isDirectory = Boolean(input.isDirectory)
    const isVirtual = Boolean(input.isVirtual)

    return {
        displayName: normalizeText(input.displayName) || (isDirectory ? '文件夹' : '附件'),
        mediaType: inferAssetPreviewMediaType({
            mediaType: input.mediaType,
            mimeType: input.mimeType,
            isDirectory,
            isVirtual,
        }),
        mimeType: normalizeText(input.mimeType),
        fileSize: normalizePositiveNumber(input.fileSize),
        url: normalizeText(input.url),
        streamUrl: normalizeText(input.streamUrl),
        thumbnailUrl: normalizeText(input.thumbnailUrl),
        processingStatus: normalizeText(input.processingStatus),
        width: normalizePositiveNumber(input.width),
        height: normalizePositiveNumber(input.height),
        durationSeconds: normalizePositiveNumber(input.durationSeconds),
        isDirectory,
        isVirtual,
    }
}

function getResourceEntryAsset(item: ResourceEntryLike) {
    return item.asset || item.asset_reference?.asset || null
}

export function buildAssetPreviewFromFileEntry(item: ResourceEntryLike): AssetPreviewModel {
    const asset = getResourceEntryAsset(item)
    const videoProcessing = resolveVideoProcessingMetadata(asset?.extra_metadata?.video_processing)

    return normalizeAssetPreviewModel({
        displayName: item.display_name,
        mediaType: asset?.media_type,
        mimeType: asset?.mime_type,
        fileSize: asset?.file_size || item.file_size,
        url: asset?.url || item.url,
        streamUrl: videoProcessing?.playlist_url,
        thumbnailUrl: videoProcessing?.thumbnail_url,
        processingStatus: videoProcessing?.status,
        width: asset?.width ?? videoProcessing?.width,
        height: asset?.height ?? videoProcessing?.height,
        durationSeconds: asset?.duration_seconds ?? videoProcessing?.duration_seconds,
        isDirectory: item.is_dir,
        isVirtual: item.is_virtual,
    })
}

export function buildAssetPreviewFromChatMessageAssetPayload(
    payload: Partial<ChatMessageAssetPayload>,
    options?: {
        fallbackDisplayName?: string
        fallbackMediaType?: string
    },
): AssetPreviewModel {
    const rawPayload = payload as Partial<ChatMessageAssetPayload> & {
        width?: number | null
        height?: number | null
        duration_seconds?: number | null
    }
    const videoProcessing = resolveVideoProcessingMetadata(payload.extra_metadata?.video_processing)

    return normalizeAssetPreviewModel({
        displayName: payload.display_name || options?.fallbackDisplayName,
        mediaType: payload.media_type || options?.fallbackMediaType,
        mimeType: payload.mime_type,
        fileSize: payload.file_size,
        url: payload.url,
        streamUrl: payload.stream_url || videoProcessing?.playlist_url,
        thumbnailUrl: payload.thumbnail_url || videoProcessing?.thumbnail_url,
        processingStatus: payload.processing_status || videoProcessing?.status,
        width: rawPayload.width ?? videoProcessing?.width,
        height: rawPayload.height ?? videoProcessing?.height,
        durationSeconds: rawPayload.duration_seconds ?? videoProcessing?.duration_seconds,
        isDirectory: false,
        isVirtual: false,
    })
}

export function buildAssetPreviewFromChatComposerAttachmentToken(
    token: Partial<ChatComposerAttachmentToken>,
    options?: {
        fallbackDisplayName?: string
        fallbackMediaType?: string
    },
): AssetPreviewModel {
    return normalizeAssetPreviewModel({
        displayName: token.display_name || options?.fallbackDisplayName,
        mediaType: token.media_type || options?.fallbackMediaType,
        mimeType: token.mime_type,
        fileSize: token.file_size,
        url: token.url,
        streamUrl: token.stream_url,
        thumbnailUrl: token.thumbnail_url,
        processingStatus: token.processing_status,
        isDirectory: false,
        isVirtual: false,
    })
}