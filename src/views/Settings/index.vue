<template>
    <a-card title="设置">
        <a-form layout="vertical" :model="formState">
            <a-divider orientation="left">基础设置</a-divider>
            <a-form-item label="系统标题">
                <a-input v-model:value="formState.systemTitle" placeholder="请输入系统标题" />
            </a-form-item>
            <a-form-item label="主题模式">
                <a-segmented v-model:value="formState.themeMode" :options="themeOptions" />
            </a-form-item>

            <a-divider orientation="left">菜单设置</a-divider>
            <a-form-item label="菜单悬停展开延时（毫秒）">
                <a-input-number v-model:value="formState.menuHoverExpandDelayMs" :min="100" :max="2000" :step="50" />
            </a-form-item>
            <a-form-item label="显示实时消息菜单">
                <a-switch v-model:checked="formState.showRealtimeMenu" />
            </a-form-item>

            <a-space>
                <a-button type="primary" @click="saveSettings">保存</a-button>
                <a-button @click="resetSettings">恢复默认</a-button>
            </a-space>
        </a-form>
    </a-card>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const formState = reactive({
    systemTitle: '',
    menuHoverExpandDelayMs: 300,
    showRealtimeMenu: true,
    themeMode: 'light' as 'light' | 'dark',
})

const themeOptions = [
    { label: '浅色', value: 'light' },
    { label: '暗色', value: 'dark' },
]

const syncFromStore = () => {
    formState.systemTitle = settingsStore.settings.systemTitle
    formState.menuHoverExpandDelayMs = settingsStore.settings.menuHoverExpandDelayMs
    formState.showRealtimeMenu = settingsStore.settings.showRealtimeMenu
    formState.themeMode = settingsStore.settings.themeMode
}

const saveSettings = () => {
    settingsStore.save({
        systemTitle: formState.systemTitle.trim() || 'Bbot 管理后台',
        menuHoverExpandDelayMs: formState.menuHoverExpandDelayMs,
        showRealtimeMenu: formState.showRealtimeMenu,
        themeMode: formState.themeMode,
    })
    syncFromStore()
    message.success('设置已保存')
}

const resetSettings = () => {
    settingsStore.reset()
    syncFromStore()
    message.success('已恢复默认设置')
}

onMounted(() => {
    syncFromStore()
})
</script>

<style scoped>
.ant-card {
    min-height: calc(100vh - 115px);
}
</style>
