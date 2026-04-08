import type { ComputedRef, Ref } from 'vue'
import { getAdminConversationsApi, getAdminMessagesApi, searchChatApi } from '@/api/chat'
import type { ChatConversationItem, ChatMessageItem, ChatSearchResult } from '@/types/chat'

export async function runSearchScene(keyword: string, searchResult: Ref<ChatSearchResult | null>) {
    const { data } = await searchChatApi({ keyword, limit: 10 })
    searchResult.value = data
}

export async function loadAuditDataScene(options: {
    keyword?: string
    conversationId?: number
    isAuditAvailable: ComputedRef<boolean>
    adminConversations: Ref<ChatConversationItem[]>
    adminMessages: Ref<(ChatMessageItem & { conversation_id: number })[]>
}) {
    if (!options.isAuditAvailable.value) {
        options.adminConversations.value = []
        options.adminMessages.value = []
        return
    }
    const [conversationResponse, messageResponse] = await Promise.all([
        getAdminConversationsApi({ keyword: options.keyword || undefined }),
        getAdminMessagesApi({ keyword: options.keyword || undefined, conversation_id: options.conversationId }),
    ])
    options.adminConversations.value = conversationResponse.data.results
    options.adminMessages.value = messageResponse.data.results
}