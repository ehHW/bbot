<template>
    <a-card class="upload-page" title="文件上传">
        <a-space style="margin-bottom: 12px" wrap>
            <a-button type="primary" @click="pickFiles">选择文件</a-button>
            <a-button @click="pickFolder">选择文件夹</a-button>
            <a-button @click="startAll">开始上传</a-button>
            <a-button :disabled="!fileStore.canResumeAll" @click="resumeAll">全部继续</a-button>
            <a-button :disabled="!fileStore.canPauseAll" @click="pauseAll">全部暂停</a-button>
            <a-button danger :disabled="!fileStore.canCancelAll" @click="cancelAll">全部取消</a-button>
            <a-button @click="clearFinished">清理已完成</a-button>
            <a-space>
                <span>刷新后自动继续暂停任务</span>
                <a-switch :checked="fileStore.autoResumePausedOnReload" @change="onToggleAutoResume" />
            </a-space>
        </a-space>

        <a-progress :percent="fileStore.overallUploadProgress" style="margin-bottom: 12px" />

        <a-table :columns="columns" :data-source="fileStore.uploadTasks" row-key="id" :pagination="{ pageSize: 8 }" :scroll="{ x: 980 }">
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'displayName'">
                    <FileNameCell :name="record.displayName" :is-dir="false" />
                </template>
                <template v-else-if="column.key === 'size'">
                    {{ formatFileSize(record.size) }}
                </template>
                <template v-else-if="column.key === 'progress'">
                    <a-progress :percent="record.progress" size="small" />
                </template>
                <template v-else-if="column.key === 'status'">
                    <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
                    <span v-if="record.errorMessage" class="error-text">{{ record.errorMessage }}</span>
                </template>
                <template v-else-if="column.key === 'actions'">
                    <a-space>
                        <a-button v-if="record.status === 'paused' || record.status === 'failed'" size="small" @click="onResume(record.id)">
                            继续
                        </a-button>
                        <a-button v-if="record.status === 'uploading'" size="small" @click="onPause(record.id)">暂停</a-button>
                        <a-button
                            v-if="record.status === 'pending' || record.status === 'uploading' || record.status === 'paused'"
                            size="small"
                            danger
                            @click="onCancel(record.id)"
                        >
                            取消
                        </a-button>
                    </a-space>
                </template>
            </template>
        </a-table>

        <input ref="fileInputRef" type="file" multiple style="display: none" @change="onPickFiles" />
        <input ref="folderInputRef" type="file" webkitdirectory directory multiple style="display: none" @change="onPickFiles" />
    </a-card>

    <a-modal
        v-model:open="selectTargetOpen"
        title="选择上传目录"
        ok-text="确定上传"
        cancel-text="取消"
        @ok="confirmUploadToCurrentFolder"
    >
        <a-breadcrumb style="margin-bottom: 12px">
            <a-breadcrumb-item v-for="item in fileStore.breadcrumbs" :key="String(item.id ?? 'root')">
                <a @click="openBreadcrumb(item.id)">{{ item.name }}</a>
            </a-breadcrumb-item>
        </a-breadcrumb>

        <a-table
            :columns="targetColumns"
            :data-source="folderEntries"
            row-key="id"
            size="small"
            :pagination="false"
            :loading="fileStore.loadingEntries"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'name'">
                    <FileNameCell :name="record.display_name" :is-dir="true" clickable @click="enterFolder(record)" />
                </template>
            </template>
        </a-table>
    </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import FileNameCell from '@/components/common/FileNameCell.vue'
import { useFileStore } from '@/stores/file'
import type { FileEntryItem } from '@/api/upload'
import { formatFileSize } from '@/utils/fileFormatter'

const fileStore = useFileStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
const selectTargetOpen = ref(false)
const waitingFiles = ref<File[]>([])

const folderEntries = computed(() => fileStore.entries.filter((item) => item.is_dir))

const columns = [
    { title: '文件名', dataIndex: 'displayName', width: 260 },
    { title: '相对路径', dataIndex: 'relativePath', width: 260 },
    { title: '大小', key: 'size', width: 120 },
    { title: '进度', key: 'progress', width: 220 },
    { title: '状态', key: 'status', width: 220 },
    { title: '操作', key: 'actions', width: 180, fixed: 'right' as const },
]

const targetColumns = [{ title: '目录', dataIndex: 'display_name', key: 'name' }]

const pickFiles = () => {
    if (!fileInputRef.value) return
    fileInputRef.value.value = ''
    fileInputRef.value.click()
}

const pickFolder = () => {
    if (!folderInputRef.value) return
    folderInputRef.value.value = ''
    folderInputRef.value.click()
}

const onPickFiles = async (event: Event) => {
    try {
        const input = event.target as HTMLInputElement
        const files = Array.from(input.files || [])
        if (files.length === 0) {
            return
        }

        waitingFiles.value = files
        await fileStore.loadEntries(fileStore.currentParentId)
        selectTargetOpen.value = true
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '选择文件失败'))
    }
}

const openBreadcrumb = async (id: number | null) => {
    try {
        await fileStore.goToBreadcrumb(id)
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '打开目录失败'))
    }
}

const enterFolder = async (folder: FileEntryItem) => {
    try {
        await fileStore.enterFolder(folder)
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '进入目录失败'))
    }
}

const confirmUploadToCurrentFolder = async () => {
    if (waitingFiles.value.length === 0) {
        message.warning('未选择文件')
        return
    }
    fileStore.addUploadFiles(waitingFiles.value, fileStore.currentParentId)
    waitingFiles.value = []
    selectTargetOpen.value = false
    message.success('已加入上传队列，请点击“开始上传”')
}

const startAll = async () => {
    try {
        await fileStore.startPendingUploads()
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '开始上传失败'))
    }
}

const resumeAll = async () => {
    try {
        const startedCount = await fileStore.resumeAllTasks()
        if (startedCount > 0) {
            message.success(`已继续 ${startedCount} 个任务`)
            return
        }
        message.info('当前没有可继续的任务')
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '继续任务失败'))
    }
}

const pauseAll = () => {
    fileStore.pauseAllTasks()
    message.success('已暂停全部上传任务')
}

const cancelAll = () => {
    const canceledCount = fileStore.cancelAllTasks()
    if (canceledCount > 0) {
        message.success(`已取消 ${canceledCount} 个任务`)
        return
    }
    message.info('当前没有可取消的任务')
}

const onToggleAutoResume = (checked: boolean) => {
    fileStore.setAutoResumePausedOnReload(checked)
    message.success(checked ? '已开启自动继续暂停任务' : '已关闭自动继续暂停任务')
}

const clearFinished = () => {
    fileStore.clearFinishedTasks()
}

const onPause = (taskId: string) => {
    fileStore.pauseTask(taskId)
}

const onResume = async (taskId: string) => {
    try {
        await fileStore.resumeTask(taskId)
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '继续任务失败'))
    }
}

const onCancel = (taskId: string) => {
    fileStore.cancelTask(taskId)
}

const statusText = (status: string) => {
    const mapping: Record<string, string> = {
        pending: '待上传',
        uploading: '上传中',
        paused: '已暂停',
        completed: '已完成',
        failed: '失败',
        canceled: '已取消',
    }
    return mapping[status] || status
}

const statusColor = (status: string) => {
    const mapping: Record<string, string> = {
        pending: 'default',
        uploading: 'processing',
        paused: 'warning',
        completed: 'success',
        failed: 'error',
        canceled: 'default',
    }
    return mapping[status] || 'default'
}

onMounted(async () => {
    try {
        await fileStore.loadEntries(null)
        if (fileStore.autoResumePausedOnReload && fileStore.pausedCount > 0) {
            await fileStore.resumePausedTasks()
            message.success('已自动继续暂停任务')
        }
    } catch (error: unknown) {
        message.error(String((error as { message?: string })?.message || '上传页面初始化失败'))
    }
})
</script>

<style scoped>
.upload-page {
    height: calc(100vh - 115px);
}

:deep(.ant-card-body) {
    height: calc(100% - 57px);
    overflow: auto;
}

.error-text {
    margin-left: 8px;
    color: var(--error-color);
}

</style>
