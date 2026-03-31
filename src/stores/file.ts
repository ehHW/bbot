import { computed, markRaw, ref, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { createFolderApi, deleteFileEntryApi, getFileEntriesApi, renameFileEntryApi } from '@/api/upload'
import type { FileEntryItem } from '@/api/upload'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { useAuthStore } from '@/stores/auth'

export type UploadTaskStatus = 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'canceled'

export interface UploadTaskItem {
    id: string
    file: File | null
    parentId: number | null
    relativePath: string
    displayName: string
    size: number
    status: UploadTaskStatus
    progress: number
    hashProgress: number
    chunkProgress: number
    mergeProgress: number
    resultPath: string
    errorMessage: string
}

const toTaskId = () => `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const UPLOAD_TASK_DB_NAME = 'bbot_upload_tasks_db'
const UPLOAD_TASK_STORE_NAME = 'upload_tasks_store'
const UPLOAD_TASKS_KEY = 'upload_tasks'
const AUTO_RESUME_PAUSED_KEY = 'bbot_auto_resume_paused_tasks'

const openUploadTaskDb = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(UPLOAD_TASK_DB_NAME, 1)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(UPLOAD_TASK_STORE_NAME)) {
                db.createObjectStore(UPLOAD_TASK_STORE_NAME)
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

const loadUploadTasksFromDb = async (): Promise<UploadTaskItem[]> => {
    const db = await openUploadTaskDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(UPLOAD_TASK_STORE_NAME, 'readonly')
        const store = tx.objectStore(UPLOAD_TASK_STORE_NAME)
        const request = store.get(UPLOAD_TASKS_KEY)
        request.onsuccess = () => {
            const value = request.result
            if (!Array.isArray(value)) {
                resolve([])
                return
            }
            resolve(value as UploadTaskItem[])
        }
        request.onerror = () => reject(request.error)
    })
}

const saveUploadTasksToDb = async (tasks: UploadTaskItem[]) => {
    const db = await openUploadTaskDb()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(UPLOAD_TASK_STORE_NAME, 'readwrite')
        const store = tx.objectStore(UPLOAD_TASK_STORE_NAME)
        store.put(tasks, UPLOAD_TASKS_KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

const toStorableTask = (task: UploadTaskItem): UploadTaskItem => {
    const rawTask = toRaw(task)
    const rawFile = rawTask.file ? toRaw(rawTask.file) : null
    return {
        ...rawTask,
        file: rawFile instanceof File ? rawFile : null,
    }
}

const normalizeTaskRelativePath = (file: File): string => {
    const raw = String((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name || '')
    return raw.replace(/\\/g, '/').replace(/^\/+/, '')
}

const pickDisplayName = (relativePath: string, fileName: string): string => {
    const normalized = (relativePath || '').split('/').filter(Boolean)
    if (normalized.length === 0) {
        return fileName
    }
    return normalized[normalized.length - 1] || fileName
}

const calcOverallProgress = (task: Pick<UploadTaskItem, 'hashProgress' | 'chunkProgress' | 'mergeProgress'>) => {
    return Math.min(100, Math.max(0, Math.floor((task.hashProgress + task.chunkProgress + task.mergeProgress) / 3)))
}

export const useFileStore = defineStore('file', () => {
    const entries = ref<FileEntryItem[]>([])
    const breadcrumbs = ref<Array<{ id: number | null; name: string }>>([{ id: null, name: '我的文件' }])
    const currentParentId = ref<number | null>(null)
    const loadingEntries = ref(false)

    const uploadTasks = ref<UploadTaskItem[]>([])
    const pauseAllRequested = ref(false)
    const isRestoringUploadTasks = ref(true)
    const autoResumePausedOnReload = ref(localStorage.getItem(AUTO_RESUME_PAUSED_KEY) === '1')

    const overallUploadProgress = computed(() => {
        if (uploadTasks.value.length === 0) return 0
        const sum = uploadTasks.value.reduce((acc, item) => acc + item.progress, 0)
        return Math.floor(sum / uploadTasks.value.length)
    })

    const activeUploadingCount = computed(() => uploadTasks.value.filter((item) => item.status === 'uploading').length)
    const resumableCount = computed(() => uploadTasks.value.filter((item) => item.status === 'paused' || item.status === 'failed').length)
    const pausedCount = computed(() => uploadTasks.value.filter((item) => item.status === 'paused').length)

    const loadEntries = async (parentId?: number | null) => {
        loadingEntries.value = true
        try {
            const targetParentId = parentId === undefined ? currentParentId.value : parentId
            const { data } = await getFileEntriesApi(targetParentId)
            entries.value = data.items
            breadcrumbs.value = data.breadcrumbs
            currentParentId.value = data.parent?.id ?? null
        } finally {
            loadingEntries.value = false
        }
    }

    const enterFolder = async (folder: FileEntryItem) => {
        if (!folder.is_dir) return
        await loadEntries(folder.id)
    }

    const goToBreadcrumb = async (id: number | null) => {
        await loadEntries(id)
    }

    const createFolder = async (name: string, parentId?: number | null) => {
        await createFolderApi({
            name,
            parent_id: parentId ?? currentParentId.value,
        })
        await loadEntries(parentId ?? currentParentId.value)
    }

    const deleteEntry = async (id: number) => {
        await deleteFileEntryApi(id)
        await loadEntries(currentParentId.value)
    }

    const renameEntry = async (id: number, name: string) => {
        await renameFileEntryApi({ id, name })
        await loadEntries(currentParentId.value)
    }

    const addUploadFiles = (files: File[], parentId?: number | null) => {
        const normalizedParentId = parentId ?? currentParentId.value
        const tasks = files.map<UploadTaskItem>((file) => {
            const relativePath = normalizeTaskRelativePath(file)
            return {
                id: toTaskId(),
                file: markRaw(file),
                parentId: normalizedParentId,
                relativePath,
                displayName: pickDisplayName(relativePath, file.name),
                size: file.size,
                status: 'pending',
                progress: 0,
                hashProgress: 0,
                chunkProgress: 0,
                mergeProgress: 0,
                resultPath: '',
                errorMessage: '',
            }
        })
        uploadTasks.value = [...tasks, ...uploadTasks.value]
    }

    const getTaskById = (taskId: string) => uploadTasks.value.find((item) => item.id === taskId)

    const runTaskUpload = async (taskId: string) => {
        const authStore = useAuthStore()
        const task = getTaskById(taskId)
        if (!task || !authStore.accessToken) {
            return
        }

        if (!task.file) {
            task.status = 'failed'
            task.errorMessage = '原始文件不可用，请重新选择文件'
            return
        }

        task.status = 'uploading'
        task.errorMessage = ''

        try {
            const result = await uploadFileWithCategory({
                file: task.file,
                token: authStore.accessToken,
                parentId: task.parentId,
                relativePath: task.relativePath,
                onHashProgress: (progress) => {
                    task.hashProgress = progress
                    task.progress = calcOverallProgress(task)
                },
                onChunkProgress: (progress) => {
                    task.chunkProgress = progress
                    task.progress = calcOverallProgress(task)
                },
                onMergeProgress: (progress) => {
                    task.mergeProgress = progress
                    task.progress = calcOverallProgress(task)
                },
                shouldPause: () => task.status === 'paused',
                shouldCancel: () => task.status === 'canceled',
            })

            task.progress = 100
            task.hashProgress = 100
            task.chunkProgress = 100
            task.mergeProgress = 100
            task.resultPath = result.relativePath
            task.status = 'completed'

            if ((task.parentId ?? null) === (currentParentId.value ?? null)) {
                await loadEntries(currentParentId.value)
            }
        } catch (error: any) {
            const message = String(error?.message || '')
            if (message.includes('暂停')) {
                task.status = 'paused'
                return
            }
            if (message.includes('取消')) {
                task.status = 'canceled'
                return
            }
            task.status = 'failed'
            task.errorMessage = message || '上传失败'
        }
    }

    const startPendingUploads = async () => {
        pauseAllRequested.value = false
        for (const task of uploadTasks.value) {
            if (pauseAllRequested.value) {
                break
            }
            if (task.status === 'pending' || task.status === 'failed') {
                // eslint-disable-next-line no-await-in-loop
                await runTaskUpload(task.id)
            }
        }
    }

    const pauseTask = (taskId: string) => {
        const task = getTaskById(taskId)
        if (!task) return
        if (task.status === 'uploading') {
            task.status = 'paused'
        }
    }

    const pauseAllTasks = () => {
        pauseAllRequested.value = true
        uploadTasks.value.forEach((task) => {
            if (task.status === 'uploading') {
                task.status = 'paused'
            }
        })
    }

    const resumeAllTasks = async () => {
        pauseAllRequested.value = false
        for (const task of uploadTasks.value) {
            if (task.status === 'paused' || task.status === 'failed') {
                // eslint-disable-next-line no-await-in-loop
                await runTaskUpload(task.id)
            }
        }
    }

    const resumePausedTasks = async () => {
        pauseAllRequested.value = false
        for (const task of uploadTasks.value) {
            if (task.status === 'paused') {
                // eslint-disable-next-line no-await-in-loop
                await runTaskUpload(task.id)
            }
        }
    }

    const resumeTask = async (taskId: string) => {
        const task = getTaskById(taskId)
        if (!task) return
        pauseAllRequested.value = false
        if (task.status === 'paused' || task.status === 'failed') {
            await runTaskUpload(taskId)
        }
    }

    const cancelTask = (taskId: string) => {
        const task = getTaskById(taskId)
        if (!task) return
        task.status = 'canceled'
    }

    const clearFinishedTasks = () => {
        uploadTasks.value = uploadTasks.value.filter((item) => item.status === 'uploading' || item.status === 'paused' || item.status === 'pending')
    }

    const setAutoResumePausedOnReload = (enabled: boolean) => {
        autoResumePausedOnReload.value = enabled
    }

    const restoreUploadTasks = async () => {
        try {
            const tasks = await loadUploadTasksFromDb()
            if (uploadTasks.value.length === 0) {
                uploadTasks.value = tasks.map((task) => ({
                    ...task,
                    file: task.file instanceof File ? markRaw(task.file) : null,
                }))
            }
        } catch {
            // ignore restore failures and keep runtime queue
        } finally {
            isRestoringUploadTasks.value = false
        }
    }

    void restoreUploadTasks()

    watch(
        uploadTasks,
        async (tasks) => {
            if (isRestoringUploadTasks.value) {
                return
            }
            try {
                const snapshot = tasks.map((task) => toStorableTask(task))
                await saveUploadTasksToDb(snapshot)
            } catch (error) {
                console.warn('保存上传任务到 IndexedDB 失败', error)
            }
        },
        { deep: true },
    )

    watch(
        autoResumePausedOnReload,
        (enabled) => {
            localStorage.setItem(AUTO_RESUME_PAUSED_KEY, enabled ? '1' : '0')
        },
        { immediate: true },
    )

    return {
        entries,
        breadcrumbs,
        currentParentId,
        loadingEntries,
        uploadTasks,
        overallUploadProgress,
        activeUploadingCount,
        resumableCount,
        pausedCount,
        autoResumePausedOnReload,
        loadEntries,
        enterFolder,
        goToBreadcrumb,
        createFolder,
        deleteEntry,
        renameEntry,
        addUploadFiles,
        runTaskUpload,
        startPendingUploads,
        pauseTask,
        pauseAllTasks,
        resumeAllTasks,
        resumePausedTasks,
        resumeTask,
        cancelTask,
        clearFinishedTasks,
        setAutoResumePausedOnReload,
    }
})
