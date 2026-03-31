import instance from '@/utils/request'

export interface FileEntryItem {
    id: number
    display_name: string
    stored_name: string
    is_dir: boolean
    parent_id: number | null
    file_size: number
    file_md5: string
    relative_path: string
    url: string
    created_at: string
    updated_at: string
}

export interface FileEntriesResponse {
    parent: { id: number; display_name: string } | null
    breadcrumbs: Array<{ id: number | null; name: string }>
    items: FileEntryItem[]
}

export interface SearchFileEntryItem extends FileEntryItem {
    directory_path: string
    full_path: string
}

export interface SearchFileEntriesResponse {
    items: SearchFileEntryItem[]
}

export interface UploadPrecheckPayload {
    file_md5: string
    file_name: string
    file_size: number
    category?: string
    parent_id?: number | null
    relative_path?: string
}

export const getFileEntriesApi = (parentId?: number | null) => {
    return instance.get<FileEntriesResponse>('upload/files/', {
        params: {
            parent_id: parentId ?? undefined,
        },
    })
}

export const searchFileEntriesApi = (keyword: string, limit: number = 50) => {
    return instance.get<SearchFileEntriesResponse>('upload/search/', {
        params: {
            keyword,
            limit,
        },
    })
}

export const createFolderApi = (payload: { name: string; parent_id?: number | null }) => {
    return instance.post<FileEntryItem>('upload/folders/', payload)
}

export const deleteFileEntryApi = (id: number) => {
    return instance.post<{ detail: string }>('upload/delete/', { id })
}

export const renameFileEntryApi = (payload: { id: number; name: string }) => {
    return instance.post<FileEntryItem>('upload/rename/', payload)
}

export const uploadSmallFileApi = (formData: FormData) => {
    return instance.post<{ mode: string; file: FileEntryItem }>('upload/small/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    })
}

export const uploadPrecheckApi = (payload: UploadPrecheckPayload) => {
    return instance.post<{ exists: boolean; message: string; file?: FileEntryItem }>('upload/precheck/', payload)
}

export const uploadChunkApi = (formData: FormData) => {
    return instance.post<{ chunk_index: number; uploaded: boolean }>('upload/chunk/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    })
}

export const getUploadedChunksApi = (fileMd5: string) => {
    return instance.get<{ uploaded_chunks: number[] }>('upload/chunks/', {
        params: { file_md5: fileMd5 },
    })
}

export const mergeChunksApi = (payload: {
    file_md5: string
    total_md5: string
    file_name: string
    total_chunks: number
    file_size: number
    category?: string
    parent_id?: number | null
    relative_path?: string
}) => {
    return instance.post<{ task_id: string; message: string }>('upload/merge/', payload, {
        timeout: 30000,
    })
}
