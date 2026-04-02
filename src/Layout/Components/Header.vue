<template>
    <a-layout-header class="header">
        <span class="title">{{ title }}</span>
        <div class="search-area">
            <a-auto-complete
                v-model:value="searchQuery"
                :options="searchOptions"
                class="header-search"
                @select="onSearchSelect"
            >
                <a-input placeholder="搜索菜单..." allow-clear>
                    <template #prefix>
                        <SearchOutlined style="color: var(--text-secondary)" />
                    </template>
                </a-input>
            </a-auto-complete>
        </div>
        <div class="right">
            <a-dropdown :trigger="['hover']">
                <div class="user-trigger">
                    <a-avatar :size="30" :src="avatar || undefined">
                        {{ avatarText }}
                    </a-avatar>
                    <span class="name">{{ username }}</span>
                    <DownOutlined class="trigger-arrow" />
                </div>
                <template #overlay>
                    <a-menu @click="onMenuClick">
                        <a-menu-item key="profile">个人中心</a-menu-item>
                        <a-menu-item key="logout">退出登录</a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </div>
    </a-layout-header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { DownOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import { routes } from '@/router/routes'

const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const userStore = useUserStore()

const username = computed(() => userStore.user?.display_name || userStore.user?.username || '-')
const avatar = computed(() => userStore.user?.avatar || '')
const avatarText = computed(() => (userStore.user?.display_name || userStore.user?.username || '?').slice(0, 1))
const title = computed(() => settingsStore.systemTitle)

interface NavMeta {
    menu?: boolean
    menuTitle?: string
    menuOrder?: number
    permissionCode?: string
}

function collectNavItems(routeList: RouteRecordRaw[], parentPath = ''): Array<{ path: string; title: string }> {
    const result: Array<{ path: string; title: string }> = []
    for (const route of routeList) {
        const isAbsolute = route.path.startsWith('/')
        const fullPath = isAbsolute
            ? route.path
            : parentPath
                ? `${parentPath}/${route.path}`.replace(/\/+/g, '/')
                : route.path
        const meta = (route.meta || {}) as NavMeta
        if (meta.menu) {
            result.push({ path: fullPath, title: meta.menuTitle || route.path })
        }
        if (route.children?.length) {
            result.push(...collectNavItems(route.children, fullPath))
        }
    }
    return result
}

const allNavItems = computed(() => {
    const layoutRoute = routes.find((r) => r.name === 'Layout')
    return collectNavItems(layoutRoute?.children || [])
})

const searchQuery = ref('')

const searchOptions = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return []
    return allNavItems.value
        .filter((item) => item.title.toLowerCase().includes(q))
        .map((item) => ({ value: item.path, label: item.title }))
})

function onSearchSelect(value: string) {
    router.push(value)
    searchQuery.value = ''
}

const goProfile = () => {
    router.push('/profile-center')
}

const logout = () => {
    authStore.clearAuth()
    router.push('/login')
}

const onMenuClick = ({ key }: { key: string }) => {
    if (key === 'profile') {
        goProfile()
        return
    }
    if (key === 'logout') {
        logout()
    }
}
</script>

<style scoped>
.header {
    background: var(--surface-header);
    padding: 0 12px;
    height: 50px;
    line-height: 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    flex-shrink: 0;
    min-width: 120px;
}

.search-area {
    flex: 1;
    display: flex;
    justify-content: center;
    padding-inline: 16px;
}

.header-search {
    width: 280px;
}

.right {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
    min-width: 120px;
    justify-content: flex-end;
}

.user-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.name {
    color: var(--text-secondary);
}

.trigger-arrow {
    color: var(--text-secondary);
    font-size: 12px;
}
</style>
