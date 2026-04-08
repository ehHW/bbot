<template>
    <a-card>
        <p>欢迎回来，{{ userStore.user?.display_name || userStore.user?.username || '-' }}</p>
        <p>当前角色：</p>
        <a-space wrap>
            <a-tag v-for="role in userStore.user?.roles || []" :key="role.id" color="blue">{{ role.name }}</a-tag>
            <a-tag v-if="(userStore.user?.roles || []).length === 0">未分配角色</a-tag>
        </a-space>
    </a-card>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
</script>

<style scoped>
.ant-card {
    min-height: 100%;
}
</style>
