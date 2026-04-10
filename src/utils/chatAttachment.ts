import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import type { UploadFileResult } from '@/utils/fileUploader'

export interface ChatAttachmentSendPayload {
    sourceAssetReferenceId: number
    displayName: string
    mediaType: string
    mimeType?: string
    fileSize?: number
    url?: string
    streamUrl?: string
    thumbnailUrl?: string
    processingStatus?: string
}

export function inferAttachmentMediaType(file: Pick<File, 'type'>, fallback?: string) {
    const normalized = String(fallback || '').trim().toLowerCase()
    if (normalized) {
        return normalized
    }
    if (file.type.startsWith('image/')) {
        return 'image'
    }
    if (file.type.startsWith('video/')) {
        return 'video'
    }
    return 'file'
}

export function buildAttachmentSendPayloadFromEntry(item: FileEntryItem | SearchFileEntryItem): ChatAttachmentSendPayload {
    const assetReferenceId = Number(item.asset_reference_id || 0)
    if (!assetReferenceId) {
        throw new Error('该文件缺少资产引用，暂时无法发送')
    }
    return {
        sourceAssetReferenceId: assetReferenceId,
        displayName: item.display_name,
        mediaType: item.asset?.media_type || item.asset_reference?.asset?.media_type || 'file',
        mimeType: item.asset?.mime_type || item.asset_reference?.asset?.mime_type || undefined,
        fileSize: item.asset?.file_size || item.file_size,
        url: item.asset?.url || item.asset_reference?.asset?.url || item.url,
        streamUrl: String(((item.asset?.extra_metadata || item.asset_reference?.asset?.extra_metadata || {}) as Record<string, unknown>)?.video_processing && (((item.asset?.extra_metadata || item.asset_reference?.asset?.extra_metadata || {}) as Record<string, unknown>).video_processing as Record<string, unknown>).playlist_url || ''),
        thumbnailUrl: String(((item.asset?.extra_metadata || item.asset_reference?.asset?.extra_metadata || {}) as Record<string, unknown>)?.video_processing && (((item.asset?.extra_metadata || item.asset_reference?.asset?.extra_metadata || {}) as Record<string, unknown>).video_processing as Record<string, unknown>).thumbnail_url || ''),
    }
}

export function buildAttachmentSendPayloadFromUploadResult(result: UploadFileResult, file: Pick<File, 'name' | 'size' | 'type'>): ChatAttachmentSendPayload {
    const assetReferenceId = Number(result.assetReferenceId ?? result.file?.asset_reference_id ?? 0)
    if (!assetReferenceId) {
        throw new Error('上传完成但未返回资产引用，无法发送附件')
    }
    return {
        sourceAssetReferenceId: assetReferenceId,
        displayName: result.file?.display_name || file.name,
        mediaType: inferAttachmentMediaType(file, result.file?.asset?.media_type),
        mimeType: result.file?.asset?.mime_type || file.type || undefined,
        fileSize: result.file?.asset?.file_size || result.file?.file_size || file.size,
        url: result.file?.asset?.url || result.file?.url || result.url,
        streamUrl: String((((result.file?.asset?.extra_metadata || {}) as Record<string, unknown>).video_processing as Record<string, unknown> | undefined)?.playlist_url || ''),
        thumbnailUrl: String((((result.file?.asset?.extra_metadata || {}) as Record<string, unknown>).video_processing as Record<string, unknown> | undefined)?.thumbnail_url || ''),
        processingStatus: String((((result.file?.asset?.extra_metadata || {}) as Record<string, unknown>).video_processing as Record<string, unknown> | undefined)?.status || ''),
    }
}