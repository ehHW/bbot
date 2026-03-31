import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import router from '@/router'
import { loginApi, profileApi, refreshTokenApi } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { globalWebSocket } from '@/utils/websocket'

export const useAuthStore = defineStore(
    'auth',
    () => {
        const accessToken = ref<string>('')
        const refreshToken = ref<string>('')
        const userStore = useUserStore()
        let wsUnsubscribe: (() => void) | null = null

        const isLogin = computed(() => Boolean(accessToken.value))

        const setTokens = (access: string, refresh: string) => {
            accessToken.value = access
            refreshToken.value = refresh
        }

        const clearAuth = () => {
            if (wsUnsubscribe) {
                wsUnsubscribe()
                wsUnsubscribe = null
            }
            globalWebSocket.disconnect()
            accessToken.value = ''
            refreshToken.value = ''
            userStore.clearUser()
        }

        const ensureGlobalWsListener = () => {
            if (wsUnsubscribe) {
                return
            }
            wsUnsubscribe = globalWebSocket.subscribe((payload) => {
                if (payload.type !== 'force_logout') {
                    return
                }

                const forceLogoutMessage = String(payload.message || '您的账号已被强制下线')
                clearAuth()
                if (router.currentRoute.value.path !== '/login') {
                    router.push('/login')
                }
                message.warning(forceLogoutMessage)
            })
        }

        const login = async (username: string, password: string) => {
            const { data } = await loginApi({ username, password })
            setTokens(data.access, data.refresh)
            userStore.setUser(data.user)
            globalWebSocket.connect(data.access, true)
            ensureGlobalWsListener()
            return data
        }

        const refreshAccessToken = async () => {
            if (!refreshToken.value) {
                throw new Error('refresh token 不存在')
            }
            const { data } = await refreshTokenApi(refreshToken.value)
            accessToken.value = data.access
            globalWebSocket.updateToken(data.access)
            if (data.refresh) {
                refreshToken.value = data.refresh
            }
            return data.access
        }

        const fetchProfile = async () => {
            if (!accessToken.value) return null
            const { data } = await profileApi()
            userStore.setUser(data)
            globalWebSocket.connect(accessToken.value)
            ensureGlobalWsListener()
            return data
        }

        const hasPermission = (code: string) => userStore.hasPermission(code)

        return {
            accessToken,
            refreshToken,
            isLogin,
            login,
            clearAuth,
            ensureGlobalWsListener,
            fetchProfile,
            refreshAccessToken,
            hasPermission,
            setTokens,
        }
    },
    {
        persist: true,
    }
)
