import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatWorkspaceForwarding } from '@/modules/chat-center/composables/useChatWorkspaceForwarding'

vi.mock('ant-design-vue', () => ({
    Modal: {
        confirm: vi.fn(),
    },
    message: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/api/chat', () => ({
    forwardMessagesApi: vi.fn(async () => undefined),
    openDirectConversationApi: vi.fn(async (userId: number) => ({
        data: {
            conversation: {
                id: 900 + userId,
            },
        },
    })),
}))

function flushPromises() {
    return Promise.resolve()
}

function createChatStore() {
    return {
        state: {
            messageState: {
                activeMessages: [
                    {
                        id: 101,
                        content: '第一条待转发消息，内容会被裁剪成摘要',
                    },
                    {
                        id: 102,
                        content: '第二条消息',
                    },
                ],
            },
            conversationState: {
                conversations: [
                    {
                        id: 12,
                        access_mode: 'member',
                        can_send_message: true,
                        type: 'direct',
                        name: '现有会话',
                        avatar: '',
                        direct_target: { id: 7, display_name: '现有好友', username: 'friend', avatar: '' },
                        last_message_preview: '最近消息',
                        last_message_at: '2026-04-10T10:00:00Z',
                    },
                    {
                        id: 18,
                        access_mode: 'stealth_readonly',
                        can_send_message: false,
                        type: 'group',
                        name: '只读会话',
                        avatar: '',
                        direct_target: null,
                        last_message_preview: '',
                        last_message_at: '2026-04-09T10:00:00Z',
                    },
                ],
            },
            friendshipState: {
                friends: [
                    {
                        accepted_at: '2026-04-10T08:00:00Z',
                        remark: '小李',
                        friend_user: { id: 8, display_name: '李雷', username: 'lilei', avatar: '' },
                        direct_conversation: null,
                    },
                ],
            },
        },
        conversation: {
            loadConversations: vi.fn(async () => undefined),
        },
        friendship: {
            loadFriends: vi.fn(async () => undefined),
        },
    }
}

describe('useChatWorkspaceForwarding', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
    })

    it('loads forward targets and opens modal when selection begins', async () => {
        const chatStore = createChatStore()
        const runtime = useChatWorkspaceForwarding({
            chatStore: chatStore as never,
            getMessageQuotePreview: (messageItem) => String(messageItem.content || ''),
            resolveMenuMessage: () => null,
            clearMessageSelection: vi.fn(),
            closeMessageMenu: vi.fn(),
        })

        runtime.beginForwardSelection([101])
        await flushPromises()
        await flushPromises()

        expect(chatStore.conversation.loadConversations).toHaveBeenCalledOnce()
        expect(chatStore.friendship.loadFriends).toHaveBeenCalledOnce()
        expect(runtime.forwardModalOpen.value).toBe(true)
        expect(runtime.filteredForwardTargets.value.map((item) => item.key)).toEqual(['conversation:12', 'friend:8'])
        expect(runtime.buildForwardMessageSummary()).toContain('第一条待转发消息')
    })

    it('confirms and submits single-message forwarding through friend target resolution', async () => {
        const { Modal, message } = await import('ant-design-vue')
        const { forwardMessagesApi, openDirectConversationApi } = await import('@/api/chat')
        vi.mocked(Modal.confirm).mockImplementation((options: any) => {
            options.onOk?.()
            options.afterClose?.()
            return {
                destroy: vi.fn(),
                update: vi.fn(),
            }
        })
        const clearMessageSelection = vi.fn()
        const closeMessageMenu = vi.fn()
        const chatStore = createChatStore()
        const runtime = useChatWorkspaceForwarding({
            chatStore: chatStore as never,
            getMessageQuotePreview: (messageItem) => String(messageItem.content || ''),
            resolveMenuMessage: () => null,
            clearMessageSelection,
            closeMessageMenu,
        })

        runtime.beginForwardSelection([101])
        await flushPromises()
        await runtime.handleSelectForwardTarget(runtime.filteredForwardTargets.value.find((item) => item.key === 'friend:8')!)

        expect(openDirectConversationApi).toHaveBeenCalledWith(8)
        expect(forwardMessagesApi).toHaveBeenCalledWith({
            target_conversation_id: 908,
            message_ids: [101],
            forward_mode: 'separate',
        })
        expect(message.success).toHaveBeenCalledWith('转发成功')
        expect(clearMessageSelection).toHaveBeenCalledOnce()
        expect(closeMessageMenu).toHaveBeenCalledOnce()
        expect(JSON.parse(window.localStorage.getItem('solbot.chat.forward.recent-targets') || '[]')).toEqual(['friend:8'])
    })

    it('opens mode modal for multi-message forwarding and submits merged mode to existing conversation', async () => {
        const { forwardMessagesApi } = await import('@/api/chat')
        const chatStore = createChatStore()
        const runtime = useChatWorkspaceForwarding({
            chatStore: chatStore as never,
            getMessageQuotePreview: (messageItem) => String(messageItem.content || ''),
            resolveMenuMessage: () => null,
            clearMessageSelection: vi.fn(),
            closeMessageMenu: vi.fn(),
        })

        runtime.beginForwardSelection([101, 102])
        await flushPromises()
        await runtime.handleSelectForwardTarget(runtime.filteredForwardTargets.value.find((item) => item.key === 'conversation:12')!)

        expect(runtime.forwardModeModalOpen.value).toBe(true)
        expect(runtime.pendingForwardTarget.value?.key).toBe('conversation:12')

        runtime.handleConfirmForwardMode('merged')
        await flushPromises()

        expect(forwardMessagesApi).toHaveBeenCalledWith({
            target_conversation_id: 12,
            message_ids: [101, 102],
            forward_mode: 'merged',
        })
    })
})