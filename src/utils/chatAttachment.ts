import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import { buildAssetPickerSelection, type AssetPickerSelection } from '@/components/assets/assetPickerAdapter'
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

export function buildAttachmentSendPayloadFromSelection(selection: AssetPickerSelection): ChatAttachmentSendPayload {
    return {
        sourceAssetReferenceId: selection.assetReferenceId,
        displayName: selection.displayName,
        mediaType: selection.mediaType,
        mimeType: selection.mimeType,
        fileSize: selection.fileSize,
        url: selection.url,
        streamUrl: selection.streamUrl,
        thumbnailUrl: selection.thumbnailUrl,
        processingStatus: selection.processingStatus || undefined,
    }
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
    return buildAttachmentSendPayloadFromSelection(buildAssetPickerSelection(item))
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