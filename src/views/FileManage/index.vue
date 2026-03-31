<template>
    <a-card class="file-manage-page" title="文件管理">
        <a-space style="margin-bottom: 12px; width: 100%; justify-content: space-between" wrap>
            <a-breadcrumb>
                <a-breadcrumb-item v-for="item in fileStore.breadcrumbs" :key="String(item.id ?? 'root')">
                    <a @click="goToBreadcrumb(item.id)">{{ item.name }}</a>
                </a-breadcrumb-item>
            </a-breadcrumb>

            <a-space>
                <a-button type="primary" @click="openCreateFolder">新建文件夹</a-button>
                <a-button @click="refresh">刷新</a-button>
            </a-space>
        </a-space>

        <!-- 搜索框 -->
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

        <a-table :columns="columns" :data-source="tableData" row-key="id" :loading="fileStore.loadingEntries || searchLoading" :pagination="{ pageSize: 12 }">
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
                    <a-tag :color="record.is_dir ? 'blue' : 'green'">{{ record.is_dir ? '文件夹' : '文件' }}</a-tag>
                </template>
                <template v-else-if="column.key === 'updated_at'">
                    <span>{{ formatDateTime(record.updated_at) }}</span>
                </template>
                <template v-else-if="column.key === 'actions'">
                    <a-space>
                        <a @click="openRename(record)">编辑</a>
                        <a v-if="!record.is_dir && record.url" :href="record.url" target="_blank" rel="noopener noreferrer">查看</a>
                        <a-popconfirm title="确认删除？" @confirm="onDelete(record.id)">
                            <a style="color: #ff4d4f">删除</a>
                        </a-popconfirm>
                    </a-space>
                </template>
            </template>
        </a-table>
    </a-card>

    <a-modal v-model:open="createFolderOpen" title="新建文件夹" ok-text="创建" cancel-text="取消" @ok="submitCreateFolder">
        <a-input v-model:value="newFolderName" placeholder="请输入文件夹名称" />
    </a-modal>

    <a-modal v-model:open="renameOpen" title="重命名" ok-text="保存" cancel-text="取消" @ok="submitRename">
        <a-input v-model:value="renameName" placeholder="请输入新的名称" />
    </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import { message } from 'ant-design-vue'
import FileNameCell from '@/components/common/FileNameCell.vue'
import { useFileStore } from '@/stores/file'
import { getErrorMessage } from '@/utils/error'
import { formatFileSize } from '@/utils/fileFormatter'
import { formatDateTime } from '@/utils/timeFormatter'
import { trimText } from '@/validators/common'
import { searchFileEntriesApi } from '@/api/upload'

const fileStore = useFileStore()
const createFolderOpen = ref(false)
const newFolderName = ref('')
const renameOpen = ref(false)
const renameName = ref('')
const renameId = ref<number | null>(null)

// 搜索相关
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

const tableData = computed<Array<FileEntryItem | SearchFileEntryItem>>(() => {
    return isSearchMode.value ? searchResults.value : fileStore.entries
})

const clearSearchState = () => {
    searchKeyword.value = ''
    suggestResults.value = []
    searchResults.value = []
    isSearchMode.value = false
}

// 计算搜索建议选项
const searchOptions = computed(() => {
    if (!getNormalizedKeyword()) {
        return []
    }

    const similar = suggestResults.value
        .slice(0, 5)
        .map(item => ({
            label: `${item.display_name} (${item.directory_path || '根目录'})`,
            value: item.display_name,
            fileId: item.id,
        }))

    return [{ label: '搜索选项', options: similar }]
})

// 执行搜索（下拉框中的搜索）
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

// 处理搜索框输入更新（防抖搜索，用户停止输入500ms后执行）
const onSearchInput = () => {
    // 清除之前的定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }
    
    // 如果输入为空，清空结果
    if (!getNormalizedKeyword()) {
        suggestResults.value = []
        return
    }
    
    // 设置新的定时器，500ms后执行搜索
    searchDebounceTimer = setTimeout(async () => {
        await performSearch()
    }, 500)
}

// 点击搜索建议项
const onSearchSelect = async (value: string, option: { fileId?: number }) => {
    searchKeyword.value = value
    const item = suggestResults.value.find(r => r.id === option?.fileId) || suggestResults.value.find(r => r.display_name === value)
    if (item) {
        await navigateToFile(item)
    }
}

// 执行全部搜索
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

// 导航到搜索结果的文件所在目录
const navigateToFile = async (item: SearchFileEntryItem) => {
    if (item.is_dir) {
        await fileStore.enterFolder(item)
    } else {
        await fileStore.loadEntries(item.parent_id ?? null)
    }
    clearSearchState()
}

// 格式化搜索结果中的路径
const formatPath = (item: SearchFileEntryItem) => {
    return item.full_path
}

const refresh = async () => {
    if (isSearchMode.value) {
        await doFullSearch()
        return
    }
    await fileStore.loadEntries(fileStore.currentParentId)
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
        await fileStore.deleteEntry(id)
        message.success('删除成功')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '删除失败'))
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

onMounted(async () => {
    await fileStore.loadEntries(null)
})

onBeforeUnmount(() => {
    // 清除搜索防抖定时器
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }
})
</script>

<style scoped>
.file-manage-page {
    height: calc(100vh - 115px);
}

:deep(.ant-card-body) {
    height: calc(100% - 57px);
    overflow: auto;
}

.search-path {
    color: var(--text-color-secondary);
    font-size: 12px;
}
</style>
