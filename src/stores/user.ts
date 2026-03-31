import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { UserItem } from '@/types/user'

export const useUserStore = defineStore(
    'user',
    () => {
        const user = ref<UserItem | null>(null)

        const isSuperuser = computed(() => Boolean(user.value?.is_superuser))

        const setUser = (nextUser: UserItem | null) => {
            user.value = nextUser
        }

        const clearUser = () => {
            user.value = null
        }

        const hasPermission = (code: string) => {
            if (!user.value) return false
            if (user.value.is_superuser) return true
            return user.value.roles.some((role) => role.permissions.some((perm) => perm.code === code))
        }

        return {
            user,
            isSuperuser,
            setUser,
            clearUser,
            hasPermission,
        }
    },
    {
        persist: true,
    },
)
