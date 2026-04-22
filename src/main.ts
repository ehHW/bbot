import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { watch } from 'vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'

import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import '@/assets/css/base.css'
import '@/assets/css/icon-theme.css'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { isMobileChatDevice } from '@/views/Chat/chatLayout'

const loadChatLayoutCss = async () => {
    const html = document.documentElement
    const useMobileChatLayout = isMobileChatDevice()

    html.classList.remove('chat-device--web', 'chat-device--mobile')
    html.classList.add(useMobileChatLayout ? 'chat-device--mobile' : 'chat-device--web')

    if (useMobileChatLayout) {
        await import('@/assets/css/chat-mobile.css')
        return
    }
    await import('@/assets/css/chat-web.css')
}

const bootstrap = async () => {
    await loadChatLayoutCss()

    const app = createApp(App)
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)

    app.use(pinia)
    app.use(router)
    app.use(Antd)

    app.mount('#app')

    const settingsStore = useSettingsStore(pinia)

    const disableDefaultContextMenu = (event: MouseEvent) => {
        event.preventDefault()
    }

    document.addEventListener('contextmenu', disableDefaultContextMenu)

    watch(
        () => settingsStore.themeMode,
        (mode) => {
            document.documentElement.setAttribute('data-theme', mode)
        },
        { immediate: true },
    )

    const bootstrapAuth = async () => {
        const authStore = useAuthStore(pinia)
        if (!authStore.accessToken) {
            return
        }

        try {
            await authStore.refreshSessionContext()
        } catch {
            authStore.clearAuth()
        }
    }

    await bootstrapAuth()
}

void bootstrap()
