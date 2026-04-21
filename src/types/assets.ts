export interface AssetPreviewModel {
    displayName: string
    mediaType: string
    mimeType?: string
    fileSize?: number
    url?: string
    streamUrl?: string
    thumbnailUrl?: string
    processingStatus?: string
    width?: number
    height?: number
    durationSeconds?: number
    isDirectory: boolean
    isVirtual: boolean
}