<template>
    <a-config-provider :locale="locale" :theme="antdThemeConfig">
        <a-layout style="height: 100vh; overflow: hidden">
            <Menu />
            <a-layout>
                <Header />
                <Main />
                <Footer />
            </a-layout>
        </a-layout>
    </a-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

import Header from '@/Layout/Components/Header.vue'
import Menu from '@/Layout/Components/Menu.vue'
import Main from '@/Layout/Components/Main.vue'
import Footer from '@/Layout/Components/Footer.vue'
import { useSettingsStore } from '@/stores/settings'
dayjs.locale('zh-cn')

const locale = zhCN
const settingsStore = useSettingsStore()

const antdThemeConfig = computed(() => {
    const isDark = settingsStore.themeMode === 'dark'
    return {
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
            colorPrimary: '#3a9ef9',
            borderRadius: 8,
        },
    }
})
</script>

<style scoped></style>
