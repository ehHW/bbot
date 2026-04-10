import { message as antMessage } from 'ant-design-vue'
import type { Ref } from 'vue'
import type { ChatConversationItem, ChatGroupJoinRequestItem, ChatMessageItem, ChatUserBrief } from '@/types/chat'
import type { WebSocketMessage } from '@/utils/websocket'
import { globalWebSocket } from '@/utils/websocket'

type TypingTimer = ReturnType<typeof setTimeout>

type HandleTypingRealtimeOptions = {
    payload: WebSocketMessage
    conversationId: number
    currentUserId?: number
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, TypingTimer>
    removeTypingUser: (conversationId: number, userId: number) => void
}

export function handleTypingRealtimePayload(options: HandleTypingRealtimeOptions) {
    const user = options.payload.user as ChatUserBrief | undefined
    if (!user || user.id === options.currentUserId) {
        return
    }
    if (!options.payload.is_typing) {
        options.removeTypingUser(options.conversationId, user.id)
        return
    }
    const key = `${options.conversationId}:${user.id}`
    const current = options.typingMap[options.conversationId] || []
    if (!current.some((item) => item.id === user.id)) {
        options.typingMap[options.conversationId] = [...current, user]
    }
    const previousTimer = options.typingTimers.get(key)
    if (previousTimer) {
        clearTimeout(previousTimer)
    }
    options.typingTimers.set(
        key,
        setTimeout(() => {
            options.removeTypingUser(options.conversationId, user.id)
            options.typingTimers.delete(key)
        }, 3000),
    )
}

type ChatRealtimeHandlerOptions = {
    activeConversationId: Ref<number | null>
    getCurrentUserId: () => number | undefined
    typingMap: Record<number, ChatUserBrief[]>
    typingTimers: Map<string, TypingTimer>
    appendFriendNotice: (notice: { id: string; title: string; description: string; created_at: string; payload: Record<string, unknown> }) => void
    appendGroupNotice: (notice: { id: string; conversation_id: number | null; message: string; created_at: string; payload: Record<string, unknown> }) => void
    clearSendingState: () => void
    loadConversations: () => Promise<void>
    loadFriendRequests: () => Promise<void>
    loadFriends: () => Promise<void>
    loadGlobalGroupJoinRequests: () => Promise<void>
    loadJoinRequests: (conversationId: number) => Promise<void>
    markConversationRead: (conversationId: number, lastReadSequence: number) => Promise<void>
    markLatestSendingMessageFailed: (conversationId: number | null, error: string) => void
    reconcileLocalMessage: (conversationId: number, clientMessageId: string | null | undefined, nextMessage: ChatMessageItem) => void
    removeTypingUser: (conversationId: number, userId: number) => void
    setConversationUnread: (conversationId: number, unreadCount: number, lastReadSequence?: number) => void
    syncConversationPreview: (conversationId: number, messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>) => void
    upsertConversation: (item: ChatConversationItem) => void
    upsertMessage: (conversationId: number, nextMessage: ChatMessageItem) => void
}

function resolveRealtimeErrorFeedback(payload: WebSocketMessage): { toastMessage: string; failedStateError: string } {
    const rawMessage = typeof payload.message === 'string' ? payload.message.trim() : ''
    if (payload.error_kind === 'schema') {
        return {
            toastMessage: '消息请求格式错误，请刷新后重试',
            failedStateError: rawMessage || '请求格式错误，消息未发送',
        }
    }
    if (payload.error_kind === 'permission') {
        return {
            toastMessage: rawMessage || '当前没有权限执行该操作',
            failedStateError: rawMessage || '没有权限，消息未发送',
        }
    }
    if (payload.error_kind === 'business') {
        return {
            toastMessage: rawMessage || '当前操作暂时无法完成',
            failedStateError: rawMessage || '当前操作暂时无法完成',
        }
    }
    return {
        toastMessage: rawMessage || '聊天操作失败',
        failedStateError: rawMessage || '发送失败',
    }
}

export function createChatRealtimeHandler(options: ChatRealtimeHandlerOptions) {
    return async (payload: WebSocketMessage) => {
        if (!payload || typeof payload.type !== 'string') {
            return
        }
        if (payload.type === 'error') {
            const feedback = resolveRealtimeErrorFeedback(payload)
            antMessage.error(feedback.toastMessage)
            options.markLatestSendingMessageFailed(options.activeConversationId.value, feedback.failedStateError)
            options.clearSendingState()
            return
        }
        if (payload.type === 'chat_message_ack') {
            const conversation = payload.conversation as ChatConversationItem | undefined
            const nextMessage = payload.message as ChatMessageItem | undefined
            const clientMessageId = typeof payload.client_message_id === 'string' ? payload.client_message_id : undefined
            if (conversation) {
                options.upsertConversation(conversation)
            }
            if (conversation && nextMessage) {
                options.reconcileLocalMessage(conversation.id, clientMessageId, nextMessage)
                options.syncConversationPreview(conversation.id, nextMessage)
            }
            options.clearSendingState()
            return
        }
        if (payload.type === 'chat_new_message') {
            const conversationId = Number(payload.conversation_id)
            const nextMessage = payload.message as ChatMessageItem | undefined
            if (conversationId && nextMessage) {
                options.upsertMessage(conversationId, { ...nextMessage, local_status: null, local_error: null })
                options.syncConversationPreview(conversationId, nextMessage)
                if (nextMessage.sender?.id === options.getCurrentUserId()) {
                    options.clearSendingState()
                }
                if (options.activeConversationId.value === conversationId && document.visibilityState === 'visible') {
                    await options.markConversationRead(conversationId, nextMessage.sequence)
                }
            }
            return
        }
        if (payload.type === 'chat_message_updated') {
            const conversationId = Number(payload.conversation_id)
            const nextMessage = payload.message as ChatMessageItem | undefined
            if (conversationId && nextMessage) {
                options.upsertMessage(conversationId, nextMessage)
                options.syncConversationPreview(conversationId, nextMessage)
            }
            return
        }
        if (payload.type === 'chat_conversation_updated') {
            const conversation = payload.conversation as ChatConversationItem | undefined
            if (conversation) {
                options.upsertConversation(conversation)
            }
            return
        }
        if (payload.type === 'chat_unread_updated') {
            options.setConversationUnread(Number(payload.conversation_id), Number(payload.unread_count || 0), Number(payload.last_read_sequence || 0) || undefined)
            return
        }
        if (payload.type === 'chat_friend_request_updated') {
            await options.loadFriendRequests()
            return
        }
        if (payload.type === 'chat_friendship_updated') {
            const action = String(payload.action || '')
            if (action === 'updated') {
                return
            }
            await Promise.all([options.loadFriends(), options.loadConversations()])
            return
        }
        if (payload.type === 'chat_group_join_request_updated') {
            const joinRequest = payload.join_request as ChatGroupJoinRequestItem | undefined
            if (joinRequest?.conversation_id) {
                await options.loadJoinRequests(joinRequest.conversation_id)
            }
            await options.loadGlobalGroupJoinRequests()
            return
        }
        if (payload.type === 'chat_typing') {
            const conversationId = Number(payload.conversation_id)
            if (!conversationId) {
                return
            }
            handleTypingRealtimePayload({
                payload,
                conversationId,
                currentUserId: options.getCurrentUserId(),
                typingMap: options.typingMap,
                typingTimers: options.typingTimers,
                removeTypingUser: options.removeTypingUser,
            })
            return
        }
        if (payload.type === 'system_notice' && payload.category === 'chat' && payload.message) {
            const noticePayload = (payload.payload || {}) as Record<string, unknown>
            const noticeType = String(noticePayload.notice_type || '')
            if (noticeType.startsWith('friend_')) {
                options.appendFriendNotice({
                    id: String(noticePayload.notice_id || `${Date.now()}_${Math.random().toString(16).slice(2)}`),
                    title: String(payload.message),
                    description: String(noticePayload.description || ''),
                    created_at: typeof payload.occurred_at === 'string' ? payload.occurred_at : new Date().toISOString(),
                    payload: noticePayload,
                })
                antMessage.info(String(payload.message))
                return
            }
            options.appendGroupNotice({
                id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                conversation_id: typeof noticePayload.conversation_id === 'number' ? noticePayload.conversation_id : null,
                message: String(payload.message),
                created_at: typeof payload.occurred_at === 'string' ? payload.occurred_at : new Date().toISOString(),
                payload: noticePayload,
            })
            antMessage.info(String(payload.message))
        }
    }
}

export function ensureChatRealtimeSubscription(options: {
    currentUnsubscribe: (() => void) | null
    handler: (payload: WebSocketMessage) => Promise<void>
    setUnsubscribe: (unsubscribe: () => void) => void
}) {
    if (options.currentUnsubscribe) {
        return
    }
    const unsubscribe = globalWebSocket.subscribe((payload) => {
        void options.handler(payload)
    })
    options.setUnsubscribe(unsubscribe)
}