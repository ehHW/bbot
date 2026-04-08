<template>
    <a-card class="file-manage-page">
        <a-tabs v-model:activeKey="activeTab" class="file-upload-tabs" @change="handleTabChange">
            <a-tab-pane key="manage" tab="文件管理">
                <a-space style="margin-bottom: 12px; width: 100%; justify-content: space-between" wrap>
                    <a-breadcrumb>
                        <a-breadcrumb-item v-for="item in fileStore.breadcrumbs" :key="String(item.id ?? 'root')">
                            <a @click="goToBreadcrumb(item.id)">{{ item.name }}</a>
                        </a-breadcrumb-item>
                    </a-breadcrumb>

                    <a-space>
                        <template v-if="isRecycleBinView">
                            <a-button @click="restoreSelected" :disabled="selectedRecycleIds.length === 0">批量还原</a-button>
                            <a-button danger @click="clearSelected" :disabled="selectedRecycleIds.length === 0">批量彻底删除</a-button>
                            <a-button danger @click="clearAllRecycleBin">清空回收站</a-button>
                        </template>
                        <a-button v-else type="primary" @click="openCreateFolder">新建文件夹</a-button>
                        <a-button @click="refresh">刷新</a-button>
                    </a-space>
                </a-space>

                <a-space style="margin-bottom: 12px; width: 100%" wrap>
                    <a-auto-complete
                        v-model:value="searchKeyword"
                        placeholder="搜索文件名..."
                        :options="searchOptions"
                        :loading="searchLoading"
                        style="width: 300px"
                        @input="onSearchInput"
                        @select="onSearchSelect"
                    />
                    <a-button type="primary" @click="doFullSearch" :loading="searchLoading">搜索全部</a-button>
                    <a-button @click="resetSearch" :loading="searchLoading">重置</a-button>
                </a-space>

                <a-table
                    :columns="columns"
                    :data-source="tableData"
                    row-key="id"
                    :loading="fileStore.loadingEntries || searchLoading"
                    :pagination="{ pageSize: 12 }"
                    :row-selection="rowSelection"
                >
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'name'">
                            <FileNameCell :name="record.display_name" :is-dir="record.is_dir" :clickable="record.is_dir" @click="enterFolder(record)" />
                        </template>
                        <template v-else-if="column.key === 'path'">
                            <span class="search-path">{{ formatPath(record) }}</span>
                        </template>
                        <template v-else-if="column.key === 'size'">
                            <span>{{ record.is_dir ? '-' : formatFileSize(record.file_size) }}</span>
                        </template>
                        <template v-else-if="column.key === 'type'">
                            <a-tag :color="record.is_recycle_bin ? 'orange' : record.is_dir ? 'blue' : 'green'">
                                {{ record.is_recycle_bin ? '回收站' : record.is_dir ? '文件夹' : '文件' }}
                            </a-tag>
                        </template>
                        <template v-else-if="column.key === 'updated_at'">
                            <span>{{ formatDateTime(record.updated_at) }}</span>
                        </template>
                        <template v-else-if="column.key === 'actions'">
                            <a-space>
                                <a v-if="isRecycleBinView" @click="restoreItem(record.id)">还原</a>
                                <a v-else-if="!record.is_system" @click="openRename(record)">编辑</a>
                                <a v-if="!record.is_dir && record.url" :href="record.url" target="_blank" rel="noopener noreferrer">查看</a>
                                <a-popconfirm
                                    v-if="isRecycleBinView || !record.is_system"
                                    :title="isRecycleBinView ? '确认彻底删除？' : '确认删除？'"
                                    @confirm="onDelete(record.id)"
                                >
                                    <a style="color: #ff4d4f">删除</a>
                                </a-popconfirm>
                            </a-space>
                        </template>
                    </template>
                </a-table>
            </a-tab-pane>

            <a-tab-pane key="upload" tab="文件上传" force-render>
                <UploadTaskPanel />
            </a-tab-pane>
        </a-tabs>
    </a-card>

    <a-modal v-model:open="createFolderOpen" title="新建文件夹" ok-text="创建" cancel-text="取消" @ok="submitCreateFolder">
        <a-input v-model:value="newFolderName" placeholder="请输入文件夹名称" />
    </a-modal>

    <a-modal v-model:open="renameOpen" title="重命名" ok-text="保存" cancel-text="取消" @ok="submitRename">
        <a-input v-model:value="renameName" placeholder="请输入新的名称" />
    </a-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import { message } from 'ant-design-vue'
import FileNameCell from '@/components/common/FileNameCell.vue'
import UploadTaskPanel from '@/views/FileManage/components/UploadTaskPanel.vue'
import { useFileStore } from '@/stores/file'
import { getErrorMessage } from '@/utils/error'
import { formatFileSize } from '@/utils/fileFormatter'
import { formatDateTime } from '@/utils/timeFormatter'
import { trimText } from '@/validators/common'
import { searchFileEntriesApi } from '@/api/upload'

const fileStore = useFileStore()
const route = useRoute()
const router = useRouter()
const createFolderOpen = ref(false)
const newFolderName = ref('')
const renameOpen = ref(false)
const renameName = ref('')
const renameId = ref<number | null>(null)
const selectedRecycleIds = ref<number[]>([])
const activeTab = ref<'manage' | 'upload'>(route.query.tab === 'upload' ? 'upload' : 'manage')

const searchKeyword = ref('')
const suggestResults = ref<SearchFileEntryItem[]>([])
const searchResults = ref<SearchFileEntryItem[]>([])
const isSearchMode = ref(false)
const searchLoading = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const getNormalizedKeyword = () => {
    const raw = typeof searchKeyword.value === 'string' ? searchKeyword.value : String(searchKeyword.value ?? '')
    return trimText(raw)
}

const baseColumns = [
    { title: '名称', dataIndex: 'display_name', key: 'name', width: 320 },
    { title: '类型', key: 'type', width: 120 },
    { title: '大小', key: 'size', width: 120 },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 220 },
    { title: '操作', key: 'actions', width: 140 },
]

const columns = computed(() => {
    if (!isSearchMode.value) {
        return baseColumns
    }
    return [
        { title: '名称', dataIndex: 'display_name', key: 'name', width: 260 },
        { title: '路径', key: 'path', width: 320 },
        { title: '类型', key: 'type', width: 120 },
        { title: '大小', key: 'size', width: 120 },
        { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 220 },
        { title: '操作', key: 'actions', width: 140 },
    ]
})

const tableData = computed<Array<FileEntryItem | SearchFileEntryItem>>(() => (isSearchMode.value ? searchResults.value : fileStore.entries))
const isRecycleBinView = computed(() => !isSearchMode.value && Boolean(fileStore.currentParent?.is_recycle_bin))

const rowSelection = computed(() => {
    if (!isRecycleBinView.value) {
        return undefined
    }
    return {
        selectedRowKeys: selectedRecycleIds.value,
        onChange: (keys: Array<string | number>) => {
            selectedRecycleIds.value = keys.map((item) => Number(item)).filter((item) => Number.isInteger(item))
        },
    }
})

const clearSearchState = () => {
    searchKeyword.value = ''
    suggestResults.value = []
    searchResults.value = []
    isSearchMode.value = false
    selectedRecycleIds.value = []
}

const searchOptions = computed(() => {
    if (!getNormalizedKeyword()) {
        return []
    }

    const similar = suggestResults.value.slice(0, 5).map((item) => ({
        label: `${item.display_name} (${item.directory_path || '根目录'})`,
        value: item.display_name,
        fileId: item.id,
    }))

    return [{ label: '搜索选项', options: similar }]
})

const performSearch = async () => {
    const keyword = getNormalizedKeyword()
    if (!keyword) {
        suggestResults.value = []
        return
    }

    searchLoading.value = true
    try {
        const { data } = await searchFileEntriesApi(keyword, 50)
        suggestResults.value = data.items
    } finally {
        searchLoading.value = false
    }
}

const onSearchInput = () => {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }

    if (!getNormalizedKeyword()) {
        suggestResults.value = []
        return
    }

    searchDebounceTimer = setTimeout(async () => {
        await performSearch()
    }, 500)
}

const onSearchSelect = async (value: string, option: { fileId?: number }) => {
    searchKeyword.value = value
    const item = suggestResults.value.find((entry) => entry.id === option?.fileId) || suggestResults.value.find((entry) => entry.display_name === value)
    if (item) {
        await navigateToFile(item)
    }
}

const doFullSearch = async () => {
    const keyword = getNormalizedKeyword()
    if (!keyword) {
        await resetSearch()
        return
    }

    searchLoading.value = true
    try {
        const { data } = await searchFileEntriesApi(keyword, 200)
        searchResults.value = data.items
        isSearchMode.value = true
        if (searchResults.value.length === 0) {
            message.info('没有找到匹配的文件')
        }
    } finally {
        searchLoading.value = false
    }
}

const resetSearch = async () => {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }
    clearSearchState()
    await fileStore.loadEntries(null)
}

const navigateToFile = async (item: SearchFileEntryItem) => {
    if (item.is_dir) {
        await fileStore.enterFolder(item)
    } else {
        await fileStore.loadEntries(item.parent_id ?? null)
    }
    clearSearchState()
}

const formatPath = (item: SearchFileEntryItem) => item.full_path

const refresh = async () => {
    if (isSearchMode.value) {
        await doFullSearch()
        return
    }
    await fileStore.loadEntries(fileStore.currentParentId)
    selectedRecycleIds.value = []
}

const goToBreadcrumb = async (id: number | null) => {
    clearSearchState()
    await fileStore.goToBreadcrumb(id)
}

const enterFolder = async (item: FileEntryItem) => {
    clearSearchState()
    await fileStore.enterFolder(item)
}

const openCreateFolder = () => {
    newFolderName.value = ''
    createFolderOpen.value = true
}

const openRename = (item: FileEntryItem) => {
    renameId.value = item.id
    renameName.value = item.display_name
    renameOpen.value = true
}

const submitCreateFolder = async () => {
    const folderName = trimText(newFolderName.value)
    if (!folderName) {
        message.warning('请输入文件夹名称')
        return
    }
    try {
        await fileStore.createFolder(folderName, fileStore.currentParentId)
        message.success('创建成功')
        createFolderOpen.value = false
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '创建失败'))
    }
}

const onDelete = async (id: number) => {
    try {
        const result = await fileStore.deleteEntry(id)
        selectedRecycleIds.value = selectedRecycleIds.value.filter((item) => item !== id)
        message.success(result.detail || (isRecycleBinView.value ? '已彻底删除' : '已移入回收站'))
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '删除失败'))
    }
}

const restoreItem = async (id: number) => {
    try {
        await fileStore.restoreRecycleEntry(id)
        selectedRecycleIds.value = selectedRecycleIds.value.filter((item) => item !== id)
        message.success('已还原')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '还原失败'))
    }
}

const restoreSelected = async () => {
    if (selectedRecycleIds.value.length === 0) {
        message.info('请先选择要还原的文件')
        return
    }
    try {
        for (const id of selectedRecycleIds.value.slice()) {
            await fileStore.restoreRecycleEntry(id)
        }
        selectedRecycleIds.value = []
        message.success('已批量还原')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '批量还原失败'))
    }
}

const clearSelected = async () => {
    if (selectedRecycleIds.value.length === 0) {
        message.info('请先选择要删除的文件')
        return
    }
    try {
        await fileStore.clearRecycleBinEntries(selectedRecycleIds.value)
        selectedRecycleIds.value = []
        message.success('已批量彻底删除')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '批量删除失败'))
    }
}

const clearAllRecycleBin = async () => {
    try {
        await fileStore.clearRecycleBinEntries()
        selectedRecycleIds.value = []
        message.success('回收站已清空')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '清空回收站失败'))
    }
}

const submitRename = async () => {
    const nextName = trimText(renameName.value)
    if (!nextName) {
        message.warning('请输入名称')
        return
    }
    if (!renameId.value) {
        return
    }
    try {
        await fileStore.renameEntry(renameId.value, nextName)
        message.success('重命名成功')
        renameOpen.value = false
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '重命名失败'))
    }
}

const handleTabChange = async (key: string) => {
    const nextTab = key === 'upload' ? 'upload' : 'manage'
    activeTab.value = nextTab
    const nextQuery = { ...route.query }
    if (nextTab === 'upload') {
        nextQuery.tab = 'upload'
    } else {
        delete nextQuery.tab
    }
    await router.replace({ path: '/file-manage', query: nextQuery })
}

watch(
    () => route.query.tab,
    (tab) => {
        activeTab.value = tab === 'upload' ? 'upload' : 'manage'
    },
    { immediate: true },
)

onMounted(async () => {
    await fileStore.loadEntries(null)
})

onBeforeUnmount(() => {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }
})
</script>

<style scoped>
.file-manage-page {
    height: 100%;
}

:deep(.ant-card-body) {
    height: 100%;
    overflow: auto;
}

.file-upload-tabs {
    min-height: 100%;
}

.search-path {
    color: var(--text-secondary);
    font-size: 12px;
}
</style>
