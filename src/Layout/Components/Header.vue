<template>
    <a-layout-header class="header">
        <span class="title">{{ title }}</span>
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
import { computed } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const userStore = useUserStore()

const username = computed(() => userStore.user?.display_name || userStore.user?.username || '-')
const avatar = computed(() => userStore.user?.avatar || '')
const avatarText = computed(() => (userStore.user?.display_name || userStore.user?.username || '?').slice(0, 1))
const title = computed(() => settingsStore.systemTitle)

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
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
}

.right {
    display: flex;
    gap: 8px;
    align-items: center;
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
