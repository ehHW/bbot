import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import type { AssetPreviewModel } from '@/types/assets'
import { buildAssetPreviewFromFileEntry, normalizeAssetPreviewModel } from '@/utils/assetPreview'

type AssetPickerEntry = FileEntryItem | SearchFileEntryItem

type UploadAssetPickerSelectionSource = {
    file?: FileEntryItem | null
    assetReferenceId?: number | null
    relativePath: string
    url: string
}

type UploadAssetFileLike = Pick<File, 'name' | 'size' | 'type'>

type AssetPickerSelectionBase = {
    entryId: number
    displayName: string
    mediaType: string
    mimeType?: string
    fileSize?: number
    url?: string
    streamUrl?: string
    thumbnailUrl?: string
    processingStatus?: string
    preview: AssetPreviewModel
    relativePath: string
    parentId: number | null
    ownerUserId?: number | null
    isDirectory: boolean
    isVirtual: boolean
    virtualPath?: string | null
    sourceEntry?: AssetPickerEntry
}

export type AssetPickerFileSelection = AssetPickerSelectionBase & {
    kind: 'file'
    assetReferenceId: number | null
}

export type AssetPickerFolderSelection = AssetPickerSelectionBase & {
    kind: 'folder'
    assetReferenceId: null
}

export type AssetPickerSelection = AssetPickerFileSelection | AssetPickerFolderSelection

function normalizeRelativePath(value?: string | null, fallback?: string | null) {
    const normalized = String(value || fallback || '').trim()
    return normalized || ''
}

function buildSelectionPreviewFields(preview: AssetPreviewModel) {
    return {
        displayName: preview.displayName,
        mediaType: preview.mediaType,
        mimeType: preview.mimeType,
        fileSize: preview.fileSize,
        url: preview.url,
        streamUrl: preview.streamUrl,
        thumbnailUrl: preview.thumbnailUrl,
        processingStatus: preview.processingStatus,
        preview,
        isDirectory: preview.isDirectory,
        isVirtual: preview.isVirtual,
    }
}

export function isFileAssetPickerSelection(
    selection: AssetPickerSelection | null | undefined,
): selection is AssetPickerFileSelection {
    return selection?.kind === 'file'
}

export function isFolderAssetPickerSelection(
    selection: AssetPickerSelection | null | undefined,
): selection is AssetPickerFolderSelection {
    return selection?.kind === 'folder'
}

export function hasAssetPickerAssetReference(
    selection: AssetPickerSelection | null | undefined,
): selection is AssetPickerFileSelection & { assetReferenceId: number } {
    return Boolean(isFileAssetPickerSelection(selection) && Number(selection.assetReferenceId || 0) > 0)
}

function buildDirectorySelection(item: AssetPickerEntry): AssetPickerFolderSelection {
    const preview = buildAssetPreviewFromFileEntry(item)

    return {
        kind: 'folder',
        entryId: item.id,
        assetReferenceId: null,
        ...buildSelectionPreviewFields(preview),
        relativePath: normalizeRelativePath(item.relative_path, item.virtual_path || item.display_name),
        parentId: item.parent_id,
        ownerUserId: item.owner_user_id ?? null,
        virtualPath: item.virtual_path ?? null,
        sourceEntry: item,
    }
}

export function buildAssetPickerSelection(item: AssetPickerEntry): AssetPickerSelection {
    if (item.is_dir) {
        return buildDirectorySelection(item)
    }

    const assetReferenceId = Number(item.asset_reference_id || 0)
    if (!assetReferenceId) {
        throw new Error('该文件缺少资产引用，暂时无法选择')
    }

    const preview = buildAssetPreviewFromFileEntry(item)

    return {
        kind: 'file',
        entryId: item.id,
        assetReferenceId,
        ...buildSelectionPreviewFields(preview),
        relativePath: normalizeRelativePath(item.relative_path, item.display_name),
        parentId: item.parent_id,
        ownerUserId: item.owner_user_id ?? null,
        virtualPath: item.virtual_path ?? null,
        sourceEntry: item,
    }
}

export function buildUploadAssetPickerSelection(
    result: UploadAssetPickerSelectionSource,
    file: UploadAssetFileLike,
): AssetPickerFileSelection {
    const entry = result.file ?? null
    const entryPreview = entry ? buildAssetPreviewFromFileEntry(entry) : null
    const preview = normalizeAssetPreviewModel({
        displayName: entryPreview?.displayName || file.name,
        mediaType: entryPreview?.mediaType,
        mimeType: entryPreview?.mimeType || file.type,
        fileSize: entryPreview?.fileSize || file.size,
        url: entryPreview?.url || result.url,
        streamUrl: entryPreview?.streamUrl,
        thumbnailUrl: entryPreview?.thumbnailUrl,
        processingStatus: entryPreview?.processingStatus,
        width: entryPreview?.width,
        height: entryPreview?.height,
        durationSeconds: entryPreview?.durationSeconds,
        isDirectory: false,
        isVirtual: Boolean(entry?.is_virtual),
    })

    return {
        kind: 'file',
        entryId: Number(entry?.id || 0),
        assetReferenceId: Number(result.assetReferenceId ?? entry?.asset_reference_id ?? 0) || null,
        ...buildSelectionPreviewFields(preview),
        relativePath: normalizeRelativePath(entry?.relative_path, result.relativePath || file.name),
        parentId: entry?.parent_id ?? null,
        ownerUserId: entry?.owner_user_id ?? null,
        virtualPath: entry?.virtual_path ?? null,
        sourceEntry: entry ?? undefined,
    }
}
