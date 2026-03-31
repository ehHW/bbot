<template>
    <a-card title="角色管理">
        <a-space style="margin-bottom: 12px; width: 100%; justify-content: space-between">
            <a-space>
                <a-input v-model:value="keyword" placeholder="按角色名/描述/权限搜索" style="width: 260px" allow-clear @press-enter="onSearch" />
                <a-button @click="onSearch">搜索</a-button>
                <a-button @click="onReset">重置</a-button>
            </a-space>
            <a-space>
                <a-button type="primary" @click="openCreate">新增角色</a-button>
                <a-button @click="loadData">刷新</a-button>
            </a-space>
        </a-space>

        <a-table
            :columns="columns"
            :data-source="roles"
            :loading="loading"
            row-key="id"
            :pagination="pagination"
            :scroll="{ x: 960, y: 500 }"
            @change="handleTableChange"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                    <a-space>
                        <a-button v-if="!isSuperAdminRole(record)" size="small" @click="openEdit(record)">编辑</a-button>
                        <a-popconfirm v-if="!isSuperAdminRole(record)" title="确认删除该角色？" @confirm="onDelete(record.id)">
                            <a-button size="small" danger>删除</a-button>
                        </a-popconfirm>
                        <a-tag v-if="isSuperAdminRole(record)" color="gold">系统内置</a-tag>
                    </a-space>
                </template>
            </template>
        </a-table>
    </a-card>

    <a-modal v-model:open="modalOpen" :title="editId ? '编辑角色' : '新增角色'" @ok="submit" :confirm-loading="saving">
        <a-form layout="vertical" :model="formState">
            <a-form-item label="角色名">
                <a-input v-model:value="formState.name" />
            </a-form-item>
            <a-form-item label="描述">
                <a-input v-model:value="formState.description" />
            </a-form-item>
            <a-form-item label="权限">
                <a-select mode="multiple" v-model:value="formState.permission_ids" :options="permissionOptions" />
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TablePaginationConfig } from 'ant-design-vue'
import { createRoleApi, deleteRoleApi, getPermissionsApi, getRolesApi, updateRoleApi } from '@/api/user'
import type { PermissionItem, RoleItem } from '@/types/user'
import { getErrorMessage } from '@/utils/error'

const loading = ref(false)
const saving = ref(false)
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const keyword = ref('')

const roles = ref<RoleItem[]>([])
const permissions = ref<PermissionItem[]>([])
const SUPER_ADMIN_ROLE_NAME = '超级管理员'

const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
})

const formState = reactive({
    name: '',
    description: '',
    permission_ids: [] as number[],
})

const columns = [
    { title: 'ID', dataIndex: 'id', width: 80, fixed: 'left' as const },
    { title: '角色名', dataIndex: 'name', width: 160 },
    { title: '描述', dataIndex: 'description', width: 220 },
    {
        title: '权限',
        width: 360,
        customRender: ({ record }: { record: RoleItem }) => record.permissions.map((item) => item.name).join(', ') || '-',
    },
    { title: '操作', key: 'action', fixed: 'right' as const, width: 140 },
]

const permissionOptions = computed(() => permissions.value.map((item) => ({ label: item.name, value: item.id })))
const isSuperAdminRole = (role: RoleItem) => role.name === SUPER_ADMIN_ROLE_NAME

const loadData = async () => {
    loading.value = true
    try {
        const [rolesRes, permsRes] = await Promise.all([
            getRolesApi({
                page: pagination.current,
                page_size: pagination.pageSize,
                keyword: keyword.value.trim() || undefined,
            }),
            getPermissionsApi({ page: 1, page_size: 500 }),
        ])
        roles.value = rolesRes.data.results
        pagination.total = rolesRes.data.count
        permissions.value = permsRes.data.results
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载角色数据失败'))
    } finally {
        loading.value = false
    }
}

const onSearch = async () => {
    pagination.current = 1
    await loadData()
}

const onReset = async () => {
    keyword.value = ''
    pagination.current = 1
    await loadData()
}

const handleTableChange = async (pager: TablePaginationConfig) => {
    pagination.current = pager.current || 1
    pagination.pageSize = pager.pageSize || 10
    await loadData()
}

const resetForm = () => {
    formState.name = ''
    formState.description = ''
    formState.permission_ids = []
}

const openCreate = () => {
    resetForm()
    editId.value = null
    modalOpen.value = true
}

const openEdit = (row: RoleItem) => {
    formState.name = row.name
    formState.description = row.description
    formState.permission_ids = row.permissions.map((item) => item.id)
    editId.value = row.id
    modalOpen.value = true
}

const submit = async () => {
    if (!formState.name.trim()) {
        message.warning('角色名不能为空')
        return
    }

    saving.value = true
    try {
        if (editId.value) {
            await updateRoleApi(editId.value, {
                name: formState.name.trim(),
                description: formState.description,
                permission_ids: formState.permission_ids,
            })
            message.success('角色更新成功')
        } else {
            await createRoleApi({
                name: formState.name.trim(),
                description: formState.description,
                permission_ids: formState.permission_ids,
            })
            message.success('角色创建成功')
        }
        modalOpen.value = false
        await loadData()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '保存失败'))
    } finally {
        saving.value = false
    }
}

const onDelete = async (id: number) => {
    try {
        await deleteRoleApi(id)
        message.success('删除成功')
        await loadData()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '删除失败'))
    }
}

onMounted(async () => {
    try {
        await loadData()
    } catch {
        // loadData already handles error messaging
    }
})
</script>

<style scoped>
.ant-card {
    height: calc(100vh - 115px);
}

:deep(.ant-card-body) {
    height: calc(100% - 57px);
    overflow: hidden;
}
</style>
