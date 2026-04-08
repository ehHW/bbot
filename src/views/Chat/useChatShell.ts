import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import type { ChatMessageItem } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'

let bootstrapped = false

export function useChatShell(options?: { bootstrap?: boolean }) {
    const chatStore = useChatStore()
    const settingsStore = useSettingsStore()
    const userStore = useUserStore()
    const router = useRouter()
    const route = useRoute()

    const avatarText = (value: string) => (value || '?').slice(0, 1).toUpperCase()
    const avatarStyle = (type: 'direct' | 'group') => ({ backgroundColor: type === 'group' ? '#154c79' : '#6c3d1b' })
    const formatShortTime = (value: string | null) => (value ? dayjs(value).format('MM-DD HH:mm') : '')
    const formatDateTime = (value: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '')
    const isSelfMessage = (messageItem: ChatMessageItem) => messageItem.sender?.id === userStore.user?.id
    const messageRowClass = (messageItem: ChatMessageItem) => ({ self: isSelfMessage(messageItem), system: messageItem.is_system })
    const canManageMembers = computed(() => ['owner', 'admin'].includes(chatStore.activeConversation?.member_role || ''))
    const canEditRoles = computed(() => chatStore.activeConversation?.member_role === 'owner')
    const canLoadOlderMessages = computed(() => {
        const activeId = chatStore.activeConversationId
        if (!activeId) {
            return false
        }
        const firstSequence = chatStore.activeMessages[0]?.sequence || 0
        return firstSequence > 1
    })
    const typingText = computed(() => {
        if (!chatStore.typingUsers.length) {
            return ''
        }
        const names = chatStore.typingUsers.map((item) => item.display_name || item.username)
        return `${names.join('、')} 正在输入...`
    })
    const isStealthAuditEnabled = computed(() => chatStore.isAuditAvailable)

    const initializeChat = async () => {
        try {
            await settingsStore.loadChatPreferences()
        } catch {
            // ignore and use local persisted settings
        }
        try {
            await chatStore.initialize(settingsStore.chatListSortMode)
            if (route.name === 'ChatCenter') {
                await router.replace({ name: 'ChatMessages' })
            }
        } catch (error: unknown) {
            message.error(getErrorMessage(error, '初始化聊天失败'))
        }
    }

    if (options?.bootstrap) {
        onMounted(() => {
            if (!bootstrapped || !chatStore.initialized) {
                bootstrapped = true
                void initializeChat()
            }
        })

        watch(
            () => settingsStore.chatListSortMode,
            (nextMode) => {
                void chatStore.loadConversations(nextMode)
            },
        )

        onBeforeUnmount(() => {
            chatStore.sendTyping(false)
        })
    }

    return {
        chatStore,
        settingsStore,
        userStore,
        avatarText,
        avatarStyle,
        formatShortTime,
        formatDateTime,
        isSelfMessage,
        messageRowClass,
        canManageMembers,
        canEditRoles,
        canLoadOlderMessages,
        typingText,
        isStealthAuditEnabled,
    }
}
