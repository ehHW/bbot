import type { ComputedRef, Ref } from 'vue'
import { getConversationDetailApi, getConversationMessagesApi, readConversationApi } from '@/api/chat'
import type { ChatConversationItem, ChatFriendshipItem, ChatMessageAssetPayload, ChatMessageCursor, ChatMessageItem } from '@/types/chat'
import { globalWebSocket } from '@/utils/websocket'
import { mergeConversationMessages } from '@/stores/chat/message'

type MessageParams = { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }

function isSelfDirectConversation(conversation: ChatConversationItem, currentUserId?: number) {
    if (conversation.type !== 'direct' || !currentUserId) {
        return false
    }
    if (conversation.direct_target?.id === currentUserId) {
        return true
    }
    return conversation.member_count === 1
}

export async function loadMessagesAction(options: {
    conversationId: number
    params?: MessageParams
    loadingMessages: Ref<boolean>
    messageMap: Record<number, ChatMessageItem[]>
    failedMessageMap: Ref<Record<number, ChatMessageItem[]>>
    cursorMap: Record<number, ChatMessageCursor>
    upsertConversation: (item: ChatConversationItem) => void
    loadMembers: (conversationId: number) => Promise<void>
    markConversationRead: (conversationId: number, lastReadSequence: number) => Promise<void>
}) {
    const { conversationId, params, loadingMessages, messageMap, failedMessageMap, cursorMap, upsertConversation, loadMembers, markConversationRead } = options
    loadingMessages.value = true
    try {
        const { data } = await getConversationMessagesApi(conversationId, params)
        messageMap[conversationId] = mergeConversationMessages(
            messageMap[conversationId] || [],
            failedMessageMap.value[conversationId] || [],
            data.items,
        )
        cursorMap[conversationId] = data.cursor
        const detail = await getConversationDetailApi(conversationId)
        upsertConversation(detail.data)
        if (detail.data.type === 'group') {
            await loadMembers(conversationId)
        }
        const lastMessage = data.items.at(-1)
        const lastSequence = lastMessage?.sequence || 0
        if (lastSequence && detail.data.unread_count > 0) {
            await markConversationRead(conversationId, lastSequence)
        }
    } finally {
        loadingMessages.value = false
    }
}

export async function loadOlderMessagesAction(options: {
    conversationId: number
    cursorMap: Record<number, ChatMessageCursor>
    loadMessages: (conversationId: number, params?: MessageParams) => Promise<void>
}) {
    const cursor = options.cursorMap[options.conversationId]
    if (!cursor?.has_more_before || !cursor.before_sequence) {
        return
    }
    await options.loadMessages(options.conversationId, { before_sequence: cursor.before_sequence, limit: 30 })
}

export async function markConversationReadAction(options: {
    conversationId: number
    lastReadSequence: number
    setConversationUnread: (conversationId: number, unreadCount: number, lastReadSequence?: number) => void
}) {
    const { conversationId, lastReadSequence, setConversationUnread } = options
    if (!lastReadSequence) {
        return
    }
    if (globalWebSocket.connected.value) {
        globalWebSocket.send({ type: 'chat_mark_read', conversation_id: conversationId, last_read_sequence: lastReadSequence })
        return
    }
    const { data } = await readConversationApi(conversationId, lastReadSequence)
    setConversationUnread(conversationId, data.unread_count, data.last_read_sequence)
}

export async function sendTextMessageAction(options: {
    content: string
    quotedMessageId?: number
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId?: number
    insertLocalMessage: (conversationId: number, content: string, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    clearSendingState: () => void
    setSending: (value: boolean) => void
    scheduleFallback: (conversationId: number, clientMessageId: string) => void
    scheduleSync: (conversationId: number, clientMessageId: string) => void
}) {
    const conversation = options.activeConversation.value
    if (!conversation) {
        throw new Error('请先选择会话')
    }
    const text = options.content.trim()
    if (!text) {
        throw new Error('消息不能为空')
    }
    if (!globalWebSocket.connected.value) {
        throw new Error('WebSocket 未连接，当前无法发送消息')
    }
    const clientMessageId = `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const directConversationDeletedFriend =
        conversation.type === 'direct' && !isSelfDirectConversation(conversation, options.currentUserId) && !options.friends.value.some((item) => item.direct_conversation?.id === conversation.id)
    if (directConversationDeletedFriend) {
        options.insertLocalMessage(conversation.id, text, clientMessageId, 'failed', '你们已不是好友，当前私聊消息发送失败')
        throw new Error('你们已不是好友，当前私聊消息发送失败')
    }
    options.insertLocalMessage(conversation.id, text, clientMessageId, 'sending')
    options.setSending(true)
    options.scheduleFallback(conversation.id, clientMessageId)
    const sent = globalWebSocket.send({
        type: 'chat_send_message',
        conversation_id: conversation.id,
        content: text,
        client_message_id: clientMessageId,
        quoted_message_id: options.quotedMessageId,
    })
    if (!sent) {
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', '消息发送失败，WebSocket 未就绪')
        options.clearSendingState()
        throw new Error('消息发送失败，WebSocket 未就绪')
    }
    options.scheduleSync(conversation.id, clientMessageId)
}

export async function retryMessageAction(options: {
    messageItem: ChatMessageItem
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId?: number
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
}) {
    const conversation = options.activeConversation.value
    const retryContent = options.messageItem.content.trim()
    const clientMessageId = String(options.messageItem.payload?.client_message_id || '')
    if (!conversation || !clientMessageId || !retryContent) {
        return
    }
    options.updateLocalMessageStatus(conversation.id, clientMessageId, 'sending')
    const directConversationDeletedFriend =
        conversation.type === 'direct' && !isSelfDirectConversation(conversation, options.currentUserId) && !options.friends.value.some((item) => item.direct_conversation?.id === conversation.id)
    if (directConversationDeletedFriend) {
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', '你们已不是好友，当前私聊消息发送失败')
        throw new Error('你们已不是好友，当前私聊消息发送失败')
    }
    const sent = globalWebSocket.send({
        type: 'chat_send_message',
        conversation_id: conversation.id,
        content: retryContent,
        client_message_id: clientMessageId,
    })
    if (!sent) {
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', '消息发送失败，WebSocket 未就绪')
        throw new Error('消息发送失败，WebSocket 未就绪')
    }
}

export async function sendAssetMessageAction(options: {
    sourceAssetReferenceId: number
    displayName: string
    mediaType: string
    mimeType?: string
    fileSize?: number
    url?: string
    quotedMessageId?: number
    existingClientMessageId?: string
    activeConversation: ComputedRef<ChatConversationItem | null>
    friends: Ref<ChatFriendshipItem[]>
    currentUserId?: number
    insertLocalAttachmentMessage: (
        conversationId: number,
        options: {
            clientMessageId: string
            displayName: string
            messageType: 'image' | 'file'
            payload: ChatMessageAssetPayload & { client_message_id: string }
            status: 'sending' | 'failed'
            error?: string
        },
    ) => void
    updateLocalMessageStatus: (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => void
    clearSendingState: () => void
    setSending: (value: boolean) => void
    scheduleFallback: (conversationId: number, clientMessageId: string) => void
    scheduleSync: (conversationId: number, clientMessageId: string) => void
}) {
    const conversation = options.activeConversation.value
    if (!conversation) {
        throw new Error('请先选择会话')
    }
    if (!globalWebSocket.connected.value) {
        throw new Error('WebSocket 未连接，当前无法发送附件')
    }

    const normalizedDisplayName = String(options.displayName || '').trim() || '附件'
    const normalizedMessageType: 'image' | 'file' = options.mediaType === 'image' || options.mediaType === 'avatar' ? 'image' : 'file'
    const directConversationDeletedFriend =
        conversation.type === 'direct' && !isSelfDirectConversation(conversation, options.currentUserId) && !options.friends.value.some((item) => item.direct_conversation?.id === conversation.id)
    const clientMessageId = options.existingClientMessageId || `chat_asset_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const payload: ChatMessageAssetPayload & { client_message_id: string } = {
        client_message_id: clientMessageId,
        asset_reference_id: options.sourceAssetReferenceId,
        source_asset_reference_id: options.sourceAssetReferenceId,
        display_name: normalizedDisplayName,
        media_type: options.mediaType,
        mime_type: options.mimeType || '',
        file_size: options.fileSize,
        url: options.url,
    }

    if (directConversationDeletedFriend) {
        const errorMessage = '你们已不是好友，当前私聊附件发送失败'
        if (options.existingClientMessageId) {
            options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', errorMessage)
        } else {
            options.insertLocalAttachmentMessage(conversation.id, {
                clientMessageId,
                displayName: normalizedDisplayName,
                messageType: normalizedMessageType,
                payload,
                status: 'failed',
                error: errorMessage,
            })
        }
        throw new Error(errorMessage)
    }

    if (options.existingClientMessageId) {
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'sending')
    } else {
        options.insertLocalAttachmentMessage(conversation.id, {
            clientMessageId,
            displayName: normalizedDisplayName,
            messageType: normalizedMessageType,
            payload,
            status: 'sending',
        })
    }

    options.setSending(true)
    options.scheduleFallback(conversation.id, clientMessageId)
    const sent = globalWebSocket.send({
        type: 'chat_send_asset_message',
        conversation_id: conversation.id,
        asset_reference_id: options.sourceAssetReferenceId,
        client_message_id: clientMessageId,
        quoted_message_id: options.quotedMessageId,
    })
    if (!sent) {
        options.updateLocalMessageStatus(conversation.id, clientMessageId, 'failed', '附件发送失败，WebSocket 未就绪')
        options.clearSendingState()
        throw new Error('附件发送失败，WebSocket 未就绪')
    }
    options.scheduleSync(conversation.id, clientMessageId)
}