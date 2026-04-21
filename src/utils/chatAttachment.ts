import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import {
    buildAssetPickerSelection,
    hasAssetPickerAssetReference,
    type AssetPickerSelection,
} from '@/components/assets/assetPickerAdapter'
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
    if (!hasAssetPickerAssetReference(selection)) {
        throw new Error('当前选择结果缺少可发送的资产引用')
    }

    const preview = selection.preview

    return {
        sourceAssetReferenceId: selection.assetReferenceId,
        displayName: preview.displayName,
        mediaType: preview.mediaType,
        mimeType: preview.mimeType,
        fileSize: preview.fileSize,
        url: preview.url,
        streamUrl: preview.streamUrl,
        thumbnailUrl: preview.thumbnailUrl,
        processingStatus: preview.processingStatus || undefined,
    }
}

export function buildAttachmentSendPayloadFromEntry(item: FileEntryItem | SearchFileEntryItem): ChatAttachmentSendPayload {
    return buildAttachmentSendPayloadFromSelection(buildAssetPickerSelection(item))
}

export function buildAttachmentSendPayloadFromUploadResult(
    result: Pick<UploadFileResult, 'selection'>,
): ChatAttachmentSendPayload {
    return buildAttachmentSendPayloadFromSelection(result.selection)
}