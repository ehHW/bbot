import { defineStore, storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useConversationChatStore } from '@/stores/chat/conversationState'
import type { ChatMessageCursor, ChatMessageItem, ChatUserBrief } from '@/types/chat'

type TypingTimer = ReturnType<typeof setTimeout>

export const useMessageChatStore = defineStore('chat-message-state', () => {
    const conversationStore = useConversationChatStore()
    const { activeConversationId } = storeToRefs(conversationStore)
    const loadingMessages = ref(false)
    const sending = ref(false)
    const failedMessageMap = ref<Record<number, ChatMessageItem[]>>({})
    const messageMap = reactive<Record<number, ChatMessageItem[]>>({})
    const cursorMap = reactive<Record<number, ChatMessageCursor>>({})
    const typingMap = reactive<Record<number, ChatUserBrief[]>>({})
    const typingTimers = new Map<string, TypingTimer>()
    const sendingFallbackTimer = ref<ReturnType<typeof setTimeout> | null>(null)
    const sendingSyncTimer = ref<ReturnType<typeof setTimeout> | null>(null)

    const activeMessages = computed(() => (activeConversationId.value ? messageMap[activeConversationId.value] || [] : []))
    const typingUsers = computed(() => (activeConversationId.value ? typingMap[activeConversationId.value] || [] : []))

    return {
        loadingMessages,
        sending,
        failedMessageMap,
        messageMap,
        cursorMap,
        typingMap,
        typingTimers,
        sendingFallbackTimer,
        sendingSyncTimer,
        activeMessages,
        typingUsers,
    }
})