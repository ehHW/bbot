import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createChatRealtimeHandler, handleTypingRealtimePayload } from '@/stores/chat/realtime'

vi.mock('ant-design-vue', () => ({
    message: {
        error: vi.fn(),
        info: vi.fn(),
    },
}))

vi.mock('@/utils/websocket', () => ({
    globalWebSocket: {
        subscribe: vi.fn(),
    },
}))

async function flushPromises() {
    await Promise.resolve()
}

function createRealtimeOptions() {
    const runtimeOptions = {
        activeConversationId: ref<number | null>(12),
        getCurrentUserId: () => 7,
        typingMap: {} as Record<number, Array<{ id: number; username: string; display_name: string; avatar: string }>>,
        typingTimers: new Map<string, ReturnType<typeof setTimeout>>(),
        appendFriendNotice: vi.fn(),
        appendGroupNotice: vi.fn(),
        clearSendingState: vi.fn(),
        loadConversations: vi.fn(async () => undefined),
        loadFriendRequests: vi.fn(async () => undefined),
        loadFriends: vi.fn(async () => undefined),
        loadGlobalGroupJoinRequests: vi.fn(async () => undefined),
        loadJoinRequests: vi.fn(async () => undefined),
        markConversationRead: vi.fn(async () => undefined),
        markLatestSendingMessageFailed: vi.fn(),
        reconcileLocalMessage: vi.fn(),
        removeTypingUser: vi.fn((conversationId: number, userId: number) => {
            const current = runtimeOptions.typingMap[conversationId] || []
            runtimeOptions.typingMap[conversationId] = current.filter((item) => item.id !== userId)
        }),
        setConversationUnread: vi.fn(),
        syncConversationPreview: vi.fn(),
        upsertConversation: vi.fn(),
        upsertMessage: vi.fn(),
    }
    return runtimeOptions
}

let options = createRealtimeOptions()

describe('chat realtime handler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        options = createRealtimeOptions()
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('maps schema errors to stable prompt and failed-state reason', async () => {
        const { message } = await import('ant-design-vue')
        const handler = createChatRealtimeHandler(options)

        await handler({ type: 'error', error_kind: 'schema', message: '消息参数非法' })

        expect(message.error).toHaveBeenCalledWith('消息请求格式错误，请刷新后重试')
        expect(options.markLatestSendingMessageFailed).toHaveBeenCalledWith(12, '消息参数非法')
        expect(options.clearSendingState).toHaveBeenCalledOnce()
    })

    it('maps permission errors to direct user-facing feedback', async () => {
        const { message } = await import('ant-design-vue')
        const handler = createChatRealtimeHandler(options)

        await handler({ type: 'error', error_kind: 'permission', message: '你们还不是好友，当前私聊暂不支持发送附件' })

        expect(message.error).toHaveBeenCalledWith('你们还不是好友，当前私聊暂不支持发送附件')
        expect(options.markLatestSendingMessageFailed).toHaveBeenCalledWith(12, '你们还不是好友，当前私聊暂不支持发送附件')
        expect(options.clearSendingState).toHaveBeenCalledOnce()
    })

    it('keeps business errors on message-driven feedback', async () => {
        const { message } = await import('ant-design-vue')
        const handler = createChatRealtimeHandler(options)

        await handler({ type: 'error', error_kind: 'business', message: '该消息已撤回，无法回复' })

        expect(message.error).toHaveBeenCalledWith('该消息已撤回，无法回复')
        expect(options.markLatestSendingMessageFailed).toHaveBeenCalledWith(12, '该消息已撤回，无法回复')
        expect(options.clearSendingState).toHaveBeenCalledOnce()
    })

    it('reconciles ack payloads', async () => {
        const handler = createChatRealtimeHandler(options)
        const conversation = { id: 12, name: '会话' }
        const messageItem = { id: 99, sequence: 3, content: 'hello', created_at: '2026-01-01T00:00:00Z' }

        await handler({
            type: 'chat_message_ack',
            conversation,
            message: messageItem,
            client_message_id: 'client-1',
        } as never)

        expect(options.upsertConversation).toHaveBeenCalledWith(conversation)
        expect(options.reconcileLocalMessage).toHaveBeenCalledWith(12, 'client-1', messageItem)
        expect(options.syncConversationPreview).toHaveBeenCalledWith(12, messageItem)
        expect(options.clearSendingState).toHaveBeenCalledOnce()
    })

    it('handles new messages, marks read when active and visible, and clears sending state for self messages', async () => {
        const handler = createChatRealtimeHandler(options)
        const nextMessage = {
            id: 66,
            sequence: 10,
            content: 'new',
            created_at: '2026-01-01T00:00:00Z',
            sender: { id: 7 },
        }

        await handler({
            type: 'chat_new_message',
            conversation_id: 12,
            message: nextMessage,
        } as never)

        expect(options.upsertMessage).toHaveBeenCalledWith(12, expect.objectContaining({ id: 66, local_status: null, local_error: null }))
        expect(options.syncConversationPreview).toHaveBeenCalledWith(12, nextMessage)
        expect(options.clearSendingState).toHaveBeenCalledOnce()
        expect(options.markConversationRead).toHaveBeenCalledWith(12, 10)
    })

    it('updates conversation and unread counters from dedicated events', async () => {
        const handler = createChatRealtimeHandler(options)
        const conversation = { id: 21, name: '更新会话' }

        await handler({ type: 'chat_conversation_updated', conversation })
        await handler({ type: 'chat_unread_updated', conversation_id: 21, unread_count: 4, last_read_sequence: 9 })

        expect(options.upsertConversation).toHaveBeenCalledWith(conversation)
        expect(options.setConversationUnread).toHaveBeenCalledWith(21, 4, 9)
    })

    it('refreshes friend request and friendship related lists', async () => {
        const handler = createChatRealtimeHandler(options)

        await handler({ type: 'chat_friend_request_updated' })
        await handler({ type: 'chat_friendship_updated', action: 'deleted' })
        await handler({ type: 'chat_friendship_updated', action: 'updated' })

        expect(options.loadFriendRequests).toHaveBeenCalledOnce()
        expect(options.loadFriends).toHaveBeenCalledOnce()
        expect(options.loadConversations).toHaveBeenCalledOnce()
    })

    it('refreshes join request lists from group join events', async () => {
        const handler = createChatRealtimeHandler(options)

        await handler({
            type: 'chat_group_join_request_updated',
            join_request: { conversation_id: 35 },
        })

        expect(options.loadJoinRequests).toHaveBeenCalledWith(35)
        expect(options.loadGlobalGroupJoinRequests).toHaveBeenCalledOnce()
    })

    it('handles typing payload lifecycle', () => {
        handleTypingRealtimePayload({
            payload: {
                type: 'chat_typing',
                user: { id: 11, username: 'peer', display_name: 'Peer', avatar: '' },
                is_typing: true,
            },
            conversationId: 12,
            currentUserId: 7,
            typingMap: options.typingMap,
            typingTimers: options.typingTimers,
            removeTypingUser: options.removeTypingUser,
        })

        expect(options.typingMap[12]).toHaveLength(1)

        vi.advanceTimersByTime(3000)

        expect(options.removeTypingUser).toHaveBeenCalledWith(12, 11)
        expect(options.typingTimers.size).toBe(0)
    })

    it('removes typing user immediately when is_typing is false', () => {
        handleTypingRealtimePayload({
            payload: {
                type: 'chat_typing',
                user: { id: 11, username: 'peer', display_name: 'Peer', avatar: '' },
                is_typing: false,
            },
            conversationId: 12,
            currentUserId: 7,
            typingMap: options.typingMap,
            typingTimers: options.typingTimers,
            removeTypingUser: options.removeTypingUser,
        })

        expect(options.removeTypingUser).toHaveBeenCalledWith(12, 11)
    })

    it('appends chat system notices and shows toast', async () => {
        const { message } = await import('ant-design-vue')
        const handler = createChatRealtimeHandler(options)

        await handler({
            type: 'system_notice',
            category: 'chat',
            message: '你已加入群聊',
            payload: { conversation_id: 88 },
        })

        expect(options.appendGroupNotice).toHaveBeenCalledWith(expect.objectContaining({
            conversation_id: 88,
            message: '你已加入群聊',
        }))
        expect(message.info).toHaveBeenCalledWith('你已加入群聊')
    })

    it('ignores malformed payloads', async () => {
        const handler = createChatRealtimeHandler(options)

        await handler(null as never)
        await handler({} as never)
        await flushPromises()

        expect(options.upsertConversation).not.toHaveBeenCalled()
        expect(options.upsertMessage).not.toHaveBeenCalled()
        expect(options.clearSendingState).not.toHaveBeenCalled()
    })
})