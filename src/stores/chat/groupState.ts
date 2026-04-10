import { defineStore, storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { useConversationChatStore } from '@/stores/chat/conversationState'
import type { ChatConversationMemberItem, ChatGroupJoinRequestItem, ChatGroupNoticeItem } from '@/types/chat'

export const useGroupChatStore = defineStore('chat-group-state', () => {
    const conversationStore = useConversationChatStore()
    const { activeConversationId } = storeToRefs(conversationStore)
    const memberMap = reactive<Record<number, ChatConversationMemberItem[]>>({})
    const joinRequestMap = reactive<Record<number, ChatGroupJoinRequestItem[]>>({})
    const groupNoticeItems = ref<ChatGroupNoticeItem[]>([])
    const globalGroupJoinRequests = ref<ChatGroupJoinRequestItem[]>([])

    const activeMembers = computed(() => (activeConversationId.value ? memberMap[activeConversationId.value] || [] : []))
    const activeJoinRequests = computed(() => (activeConversationId.value ? joinRequestMap[activeConversationId.value] || [] : []))

    return {
        memberMap,
        joinRequestMap,
        groupNoticeItems,
        globalGroupJoinRequests,
        activeMembers,
        activeJoinRequests,
    }
})