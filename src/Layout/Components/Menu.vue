<template>
    <a-layout-sider
        v-model:collapsed="collapsed"
        collapsible
        :trigger="null"
        collapsed-width="50px"
        :style="siderStyle"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
    >
        <div class="logo">
            <img src="@/assets/img/miao.png" alt="" />
        </div>

        <a-menu v-model:selectedKeys="selectedKeys" :theme="menuTheme" mode="inline" @click="handleMenuClick">
            <a-menu-item v-for="item in menuItems" :key="item.path">
                <template #icon>
                    <component :is="item.icon" />
                </template>
                {{ item.title }}
            </a-menu-item>
        </a-menu>
    </a-layout-sider>
</template>

<script setup lang="ts">
import {
    ApiOutlined,
    BellOutlined,
    HomeOutlined,
    LockOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    TeamOutlined,
    ToolOutlined,
    UploadOutlined,
    UserOutlined,
} from '@ant-design/icons-vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { routes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

interface MenuMeta {
    menu?: boolean
    menuTitle?: string
    menuIcon?: 'home' | 'setting' | 'lock' | 'tool' | 'api' | 'upload' | 'user' | 'team' | 'safety' | 'message'
    menuSettingKey?: 'showRealtimeMenu'
    permissionCode?: string
}

const iconMap = {
    home: HomeOutlined,
    setting: SettingOutlined,
    lock: LockOutlined,
    tool: ToolOutlined,
    api: ApiOutlined,
    upload: UploadOutlined,
    user: UserOutlined,
    team: TeamOutlined,
    safety: SafetyCertificateOutlined,
    message: BellOutlined,
}

const collapsed = ref<boolean>(true)
const selectedKeys = ref<string[]>([])
let expandTimer: ReturnType<typeof setTimeout> | null = null

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const menuTheme = computed<'light' | 'dark'>(() => (settingsStore.themeMode === 'dark' ? 'dark' : 'light'))
const siderStyle = computed(() => ({
    backgroundColor: 'var(--surface-sidebar)',
}))

const route = useRoute()
const router = useRouter()

const menuItems = computed(() => {
    const layoutRoute = routes.find((item) => item.name === 'Layout')
    const children = layoutRoute?.children || []

    return children
        .filter((item) => {
            const meta = (item.meta || {}) as MenuMeta
            if (!meta.menu) return false
            if (meta.menuSettingKey === 'showRealtimeMenu' && !settingsStore.showRealtimeMenu) return false
            if (meta.permissionCode && !authStore.hasPermission(meta.permissionCode)) return false
            return true
        })
        .map((item) => {
            const meta = (item.meta || {}) as MenuMeta
            const iconKey = meta.menuIcon || 'setting'
            return {
                path: item.path,
                title: meta.menuTitle || String(item.meta?.title || item.name || item.path),
                icon: iconMap[iconKey],
            }
        })
})

watch(
    () => route.path,
    (path) => {
        selectedKeys.value = [path]
    },
    { immediate: true },
)

const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key)
}

const handleMouseEnter = () => {
    if (expandTimer) {
        clearTimeout(expandTimer)
    }
    expandTimer = setTimeout(() => {
        collapsed.value = false
        expandTimer = null
    }, settingsStore.menuHoverExpandDelayMs)
}

const handleMouseLeave = () => {
    if (expandTimer) {
        clearTimeout(expandTimer)
        expandTimer = null
    }
    collapsed.value = true
}

onBeforeUnmount(() => {
    if (expandTimer) {
        clearTimeout(expandTimer)
        expandTimer = null
    }
})
</script>

<style scoped>
.logo {
    margin-inline: 4px;
    margin-block: 4px;
    width: calc(100% - 8px);
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;

    > img {
        width: 20px;
        height: 20px;
    }
}
</style>
