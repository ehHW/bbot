import { getUploadedChunksApi, mergeChunksApi, uploadChunkApi, uploadPrecheckApi, uploadSmallFileApi } from '@/api/upload'
import type { FileEntryItem } from '@/api/upload'
import { buildUploadAssetPickerSelection, type AssetPickerSelection } from '@/components/assets/assetPickerAdapter'
import type { AssetPreviewModel } from '@/types/assets'
import { calculateFileHashes } from '@/utils/fileHash'
import { waitForUploadTaskRealtime } from '@/utils/uploadRealtimeRuntime'
import { globalWebSocket } from '@/utils/websocket'

export const SMALL_FILE_THRESHOLD = 100 * 1024 * 1024
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024
export const MAX_UPLOAD_FILE_SIZE = 1024 * 1024 * 1024

export interface UploadFileOptions {
    file: File
    category?: string
    token: string
    parentId?: number | null
    relativePath?: string
    chunkSize?: number
    onHashProgress?: (progress: number) => void
    onChunkProgress?: (progress: number) => void
    onMergeProgress?: (progress: number) => void
    onLog?: (message: string) => void
    shouldPause?: () => boolean
    shouldCancel?: () => boolean
}

export interface UploadFileResult {
    mode: 'direct' | 'instant' | 'chunked'
    relativePath: string
    url: string
    file?: FileEntryItem
    assetReferenceId?: number | null
    selection: AssetPickerSelection
    preview: AssetPreviewModel
}

function attachUploadSelection(
    result: Omit<UploadFileResult, 'selection' | 'preview'>,
    file: Pick<File, 'name' | 'size' | 'type'>,
): UploadFileResult {
    const selection = buildUploadAssetPickerSelection(result, file)

    return {
        ...result,
        selection,
        preview: selection.preview,
    }
}

export const uploadFileWithCategory = async ({
    file,
    category,
    token,
    parentId,
    relativePath,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onHashProgress,
    onChunkProgress,
    onMergeProgress,
    onLog,
    shouldPause,
    shouldCancel,
}: UploadFileOptions): Promise<UploadFileResult> => {
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
        throw new Error(`文件不能超过 ${MAX_UPLOAD_FILE_SIZE / 1024 / 1024 / 1024}GB`)
    }

    const checkInterrupted = () => {
        if (shouldCancel?.()) {
            throw new Error('上传已取消')
        }
        if (shouldPause?.()) {
            throw new Error('上传已暂停')
        }
    }

    checkInterrupted()

    if (file.size <= SMALL_FILE_THRESHOLD) {
        const formData = new FormData()
        formData.append('file', file)
        if (category) {
            formData.append('category', category)
        }
        if (parentId != null) {
            formData.append('parent_id', String(parentId))
        }
        if (relativePath) {
            formData.append('relative_path', relativePath)
        }

        const { data } = await uploadSmallFileApi(formData, {
            onUploadProgress: (progressEvent: any) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    onChunkProgress?.(percentCompleted)
                }
            }
        })

        onHashProgress?.(100)
        onChunkProgress?.(100)
        onMergeProgress?.(100)
        return attachUploadSelection({
            mode: data.mode === 'instant' ? 'instant' : 'direct',
            relativePath: data.file.relative_path,
            url: data.file.url,
            file: data.file,
            assetReferenceId: data.file.asset_reference_id ?? null,
        }, file)
    }

    onLog?.('开始计算文件与分片 MD5')
    const hashResult = await calculateFileHashes(file, chunkSize, onHashProgress)
    checkInterrupted()

    const { fileMd5, chunkMd5List, totalChunks } = hashResult
    onLog?.(`MD5 计算完成: ${fileMd5}`)

    const precheckRes = await uploadPrecheckApi({
        file_md5: fileMd5,
        file_name: file.name,
        file_size: file.size,
        category,
        parent_id: parentId,
        relative_path: relativePath,
    })

    if (precheckRes.data.exists) {
        onChunkProgress?.(100)
        onMergeProgress?.(100)
        onLog?.('命中秒传，跳过分片上传')
        return attachUploadSelection({
            mode: 'instant',
            relativePath: precheckRes.data.file?.relative_path || '',
            url: precheckRes.data.file?.url || '',
            file: precheckRes.data.file,
            assetReferenceId: precheckRes.data.file?.asset_reference_id ?? null,
        }, file)
    }

    const uploadedRes = await getUploadedChunksApi(fileMd5, category)
    const uploadedSet = new Set(uploadedRes.data.uploaded_chunks || [])
    let finished = uploadedSet.size
    onChunkProgress?.(Math.floor((finished / totalChunks) * 100))

    for (let index = 0; index < totalChunks; index += 1) {
        checkInterrupted()

        const chunkIndex = index + 1
        if (uploadedSet.has(chunkIndex)) {
            continue
        }

        const currentChunkMd5 = chunkMd5List[index] || ''
        if (!currentChunkMd5) {
            throw new Error(`第 ${chunkIndex} 个分片MD5缺失`)
        }

        const start = index * chunkSize
        const end = Math.min(file.size, start + chunkSize)
        const chunkBlob = file.slice(start, end)
        const formData = new FormData()
        formData.append('file_md5', fileMd5)
        formData.append('chunk_index', String(chunkIndex))
        formData.append('chunk_md5', currentChunkMd5)
        if (category) {
            formData.append('category', category)
        }
        formData.append('chunk', chunkBlob, `${file.name}.part${chunkIndex}`)
        await uploadChunkApi(formData)

        finished += 1
        onChunkProgress?.(Math.floor((finished / totalChunks) * 100))
        onLog?.(`分片上传完成 ${chunkIndex}/${totalChunks}`)
    }

    onLog?.('分片上传完成，提交后台合并任务')
    const mergeRes = await mergeChunksApi({
        file_md5: fileMd5,
        total_md5: fileMd5,
        file_name: file.name,
        total_chunks: totalChunks,
        file_size: file.size,
        category,
        parent_id: parentId,
        relative_path: relativePath,
    })

    const realtimeResult = await waitForUploadTaskRealtime({
        taskId: mergeRes.data.task_id,
        token,
        onProgress: onMergeProgress,
        onLog,
    })

    return attachUploadSelection(realtimeResult, file)
}
