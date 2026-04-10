import type { Ref } from 'vue'
import { removeMessageByClientId } from '@/stores/chat/message'
import type { ChatConversationItem, ChatMessageAssetPayload, ChatMessageItem } from '@/types/chat'

export function createMessageLocalState(options: {
    conversations: Ref<ChatConversationItem[]>
    messageMap: Record<number, ChatMessageItem[]>
    failedMessageMap: Ref<Record<number, ChatMessageItem[]>>
    currentUser: () => { id: number; username: string; display_name: string; avatar: string } | null
    sortCurrentConversations: () => void
}) {
    const getLastSequence = (conversationId: number) => {
        const items = options.messageMap[conversationId] || []
        const lastItem = items.at(-1)
        return lastItem ? Number(lastItem.sequence) : 0
    }

    const upsertFailedMessage = (conversationId: number, messageItem: ChatMessageItem) => {
        const failedItems = options.failedMessageMap.value[conversationId] || []
        const next = failedItems.filter((item) => String(item.payload?.client_message_id || '') !== String(messageItem.payload?.client_message_id || ''))
        next.push({ ...messageItem, local_status: 'failed' })
        options.failedMessageMap.value = {
            ...options.failedMessageMap.value,
            [conversationId]: next.sort((left, right) => left.sequence - right.sequence),
        }
    }

    const removeLocalMessageByClientId = (conversationId: number, clientMessageId: string) => {
        const items = options.messageMap[conversationId] || []
        options.messageMap[conversationId] = removeMessageByClientId(items, clientMessageId)
        const failedItems = options.failedMessageMap.value[conversationId] || []
        options.failedMessageMap.value = {
            ...options.failedMessageMap.value,
            [conversationId]: removeMessageByClientId(failedItems, clientMessageId),
        }
    }

    const updateConversationPreview = (conversationId: number, preview: string, createdAt: string) => {
        const conversation = options.conversations.value.find((item) => item.id === conversationId)
        if (!conversation) {
            return
        }
        conversation.last_message_preview = preview
        conversation.last_message_at = createdAt
        if (!conversation.show_in_list) {
            conversation.show_in_list = true
        }
        options.sortCurrentConversations()
    }

    const updateLocalMessageStatus = (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => {
        const items = options.messageMap[conversationId] || []
        options.messageMap[conversationId] = items.map((item) => {
            if (String(item.payload?.client_message_id || '') !== clientMessageId) {
                return item
            }
            return {
                ...item,
                local_status: status,
                local_error: error || null,
            }
        })
        const target = (options.messageMap[conversationId] || []).find((item) => String(item.payload?.client_message_id || '') === clientMessageId)
        if (!target) {
            return
        }
        if (status === 'failed') {
            upsertFailedMessage(conversationId, target)
            return
        }
        const failedItems = options.failedMessageMap.value[conversationId] || []
        options.failedMessageMap.value = {
            ...options.failedMessageMap.value,
            [conversationId]: failedItems.filter((item) => String(item.payload?.client_message_id || '') !== clientMessageId),
        }
    }

    const updateLocalAttachmentPayload = (conversationId: number, clientMessageId: string, payloadPatch: Partial<ChatMessageAssetPayload>) => {
        const items = options.messageMap[conversationId] || []
        options.messageMap[conversationId] = items.map((item) => {
            if (String(item.payload?.client_message_id || '') !== clientMessageId) {
                return item
            }
            return {
                ...item,
                payload: {
                    ...(item.payload || {}),
                    ...payloadPatch,
                },
            }
        })
        const failedItems = options.failedMessageMap.value[conversationId] || []
        options.failedMessageMap.value = {
            ...options.failedMessageMap.value,
            [conversationId]: failedItems.map((item) => {
                if (String(item.payload?.client_message_id || '') !== clientMessageId) {
                    return item
                }
                return {
                    ...item,
                    payload: {
                        ...(item.payload || {}),
                        ...payloadPatch,
                    },
                }
            }),
        }
    }

    const insertLocalMessage = (conversationId: number, content: string, clientMessageId: string, status: 'sending' | 'failed', error?: string) => {
        const currentUser = options.currentUser()
        const tempMessage: ChatMessageItem = {
            id: -Date.now(),
            sequence: getLastSequence(conversationId) + 0.01,
            message_type: 'text',
            content,
            payload: { client_message_id: clientMessageId },
            is_system: false,
            sender: currentUser,
            created_at: new Date().toISOString(),
            local_status: status,
            local_error: error || null,
        }
        const items = options.messageMap[conversationId] || []
        options.messageMap[conversationId] = [...items, tempMessage]
        if (status === 'failed') {
            upsertFailedMessage(conversationId, tempMessage)
        }
        updateConversationPreview(conversationId, content, tempMessage.created_at)
    }

    const insertLocalAttachmentMessage = (
        conversationId: number,
        attachmentOptions: {
            clientMessageId: string
            displayName: string
            messageType: 'image' | 'file'
            payload: ChatMessageAssetPayload & { client_message_id: string }
            status: 'sending' | 'failed'
            error?: string
        },
    ) => {
        const currentUser = options.currentUser()
        const tempMessage: ChatMessageItem = {
            id: -Date.now(),
            sequence: getLastSequence(conversationId) + 0.01,
            message_type: attachmentOptions.messageType,
            content: attachmentOptions.displayName,
            payload: { ...attachmentOptions.payload },
            is_system: false,
            sender: currentUser,
            created_at: new Date().toISOString(),
            local_status: attachmentOptions.status,
            local_error: attachmentOptions.error || null,
        }
        const items = options.messageMap[conversationId] || []
        options.messageMap[conversationId] = [...items, tempMessage]
        if (attachmentOptions.status === 'failed') {
            upsertFailedMessage(conversationId, tempMessage)
        }
        updateConversationPreview(conversationId, attachmentOptions.displayName, tempMessage.created_at)
    }

    const reconcileLocalMessage = (conversationId: number, clientMessageId: string | null | undefined, nextMessage: ChatMessageItem, upsertMessage: (conversationId: number, nextMessage: ChatMessageItem) => void) => {
        if (clientMessageId) {
            removeLocalMessageByClientId(conversationId, clientMessageId)
        }
        upsertMessage(conversationId, { ...nextMessage, local_status: null, local_error: null })
    }

    const markLatestSendingMessageFailed = (conversationId: number | null, error: string) => {
        if (!conversationId) {
            return
        }
        const items = options.messageMap[conversationId] || []
        const target = [...items].reverse().find((item) => item.local_status === 'sending')
        const clientMessageId = String(target?.payload?.client_message_id || '')
        if (!clientMessageId) {
            return
        }
        updateLocalMessageStatus(conversationId, clientMessageId, 'failed', error)
    }

    return {
        getLastSequence,
        removeLocalMessageByClientId,
        upsertFailedMessage,
        updateLocalMessageStatus,
        updateLocalAttachmentPayload,
        insertLocalMessage,
        insertLocalAttachmentMessage,
        reconcileLocalMessage,
        markLatestSendingMessageFailed,
    }
}