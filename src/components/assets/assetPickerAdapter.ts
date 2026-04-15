import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'

export interface AssetPickerSelection {
    entryId: number
    assetReferenceId: number
    displayName: string
    mediaType: string
    mimeType?: string
    fileSize?: number
    url?: string
    streamUrl?: string
    thumbnailUrl?: string
    processingStatus?: string
    sourceEntry: FileEntryItem | SearchFileEntryItem
}

function getAssetMetadata(item: FileEntryItem | SearchFileEntryItem) {
    return item.asset || item.asset_reference?.asset || null
}

function getVideoProcessingMetadata(item: FileEntryItem | SearchFileEntryItem) {
    const metadata = (getAssetMetadata(item)?.extra_metadata || {}) as Record<string, unknown>
    const videoProcessing = metadata.video_processing
    return videoProcessing && typeof videoProcessing === 'object'
        ? (videoProcessing as Record<string, unknown>)
        : null
}

export function buildAssetPickerSelection(item: FileEntryItem | SearchFileEntryItem): AssetPickerSelection {
    const assetReferenceId = Number(item.asset_reference_id || 0)
    if (!assetReferenceId) {
        throw new Error('该文件缺少资产引用，暂时无法选择')
    }

    const assetMetadata = getAssetMetadata(item)
    const videoProcessing = getVideoProcessingMetadata(item)

    return {
        entryId: item.id,
        assetReferenceId,
        displayName: item.display_name,
        mediaType: assetMetadata?.media_type || 'file',
        mimeType: assetMetadata?.mime_type || undefined,
        fileSize: assetMetadata?.file_size || item.file_size,
        url: assetMetadata?.url || item.url,
        streamUrl: String(videoProcessing?.playlist_url || ''),
        thumbnailUrl: String(videoProcessing?.thumbnail_url || ''),
        processingStatus: String(videoProcessing?.status || ''),
        sourceEntry: item,
    }
}
