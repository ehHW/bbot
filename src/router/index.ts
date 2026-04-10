import { createRouter, createWebHistory } from 'vue-router'
import { startProgress, closeProgress } from '@/utils/nprogress'
import { routes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

router.beforeEach(async (to, from) => {
    const disableProgress = to.matched.some((item) => item.meta?.disableProgress)
    if (!disableProgress) {
        startProgress()
    }
    const authStore = useAuthStore()
    const userStore = useUserStore()

    if (to.path === '/login' && authStore.isLogin) {
        return '/home'
    }

    if (to.meta.requiresAuth !== false && !authStore.isLogin) {
        return '/login'
    }

    if (authStore.isLogin && !userStore.user) {
        try {
            await authStore.fetchProfile()
        } catch {
            authStore.clearAuth()
            return '/login'
        }
    }

    const permissionCode = typeof to.meta.permissionCode === 'string' ? to.meta.permissionCode : ''
    if (permissionCode && !authStore.hasPermission(permissionCode)) {
        return '/home'
    }

    if (to.matched.some((item) => item.meta?.superuserOnly) && !userStore.isSuperuser) {
        return '/home'
    }
})

router.afterEach((to) => {
    if (!to.matched.some((item) => item.meta?.disableProgress)) {
        closeProgress()
    }
})

export default router
