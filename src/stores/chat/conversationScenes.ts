import type { Ref } from 'vue'
import { createGroupConversationApi, openDirectConversationApi } from '@/api/chat'
import { updateConversationPreferencesAction, updateGroupConfigAction } from '@/stores/chat/groupActions'
import type { ChatConversationItem } from '@/types/chat'

type GroupConfigPayload = {
    name?: string
    avatar?: string
    join_approval_required?: boolean
    allow_member_invite?: boolean
    max_members?: number | null
    mute_all?: boolean
}

export async function openDirectConversationScene(options: {
    targetUserId: number
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
    loadFriends: () => Promise<void>
    selectConversation: (conversationId: number) => Promise<void>
}) {
    const { data } = await openDirectConversationApi(options.targetUserId)
    await options.loadConversations()
    await options.loadContactGroupConversations()
    await options.loadFriends()
    await options.selectConversation(data.conversation.id)
}

export async function createGroupConversationScene(options: {
    payload: {
        name: string
        member_user_ids: number[]
        join_approval_required: boolean
        allow_member_invite: boolean
    }
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
    selectConversation: (conversationId: number) => Promise<void>
}) {
    const { data } = await createGroupConversationApi(options.payload)
    await options.loadConversations()
    await options.loadContactGroupConversations()
    await options.selectConversation(data.conversation.id)
}

export async function updateGroupConfigScene(options: {
    conversationId: number
    payload: GroupConfigPayload
    conversations: Ref<ChatConversationItem[]>
    upsertConversation: (conversation: ChatConversationItem) => void
}) {
    const { data } = await updateGroupConfigAction(options.conversationId, options.payload)
    const target = options.conversations.value.find((item) => item.id === options.conversationId)
    if (target && target.group_config) {
        target.group_config = {
            ...target.group_config,
            ...data.group_config,
        }
    }
    options.upsertConversation(data.conversation)
    return data.group_config
}

export async function updateConversationPreferencesScene(options: {
    conversationId: number
    payload: { mute_notifications?: boolean; group_nickname?: string }
    upsertConversation: (conversation: ChatConversationItem) => void
}) {
    const { data } = await updateConversationPreferencesAction(options.conversationId, options.payload)
    options.upsertConversation(data.conversation)
    return data.member_settings
}