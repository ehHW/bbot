import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatWorkspaceRecords } from '@/modules/chat-center/composables/useChatWorkspaceRecords'

vi.mock('ant-design-vue', () => ({
    message: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    },
}))

describe('useChatWorkspaceRecords', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn(async () => undefined),
            },
        })
    })

    it('opens, closes, removes, and clears record viewers from message payloads', () => {
        const beginForwardSelection = vi.fn()
        const record = {
            version: 1,
            title: '聊天记录',
            footer_label: '2 条消息',
            items: [
                {
                    source_message_id: 1,
                    sequence: 1,
                    conversation_id: 12,
                    message_type: 'text' as const,
                    sender_name: 'Alice',
                    sender_avatar: '',
                    content: 'hello',
                },
            ],
        }
        const runtime = useChatWorkspaceRecords({
            getChatRecordPayload: () => record,
            beginForwardSelection,
        })

        runtime.openChatRecordViewerFromMessage({ id: 9 } as never)

        expect(runtime.chatRecordViewerStack.value).toHaveLength(1)
        expect(runtime.chatRecordViewerStack.value[0]).toMatchObject({ open: true, record })

        runtime.closeChatRecordViewer(runtime.chatRecordViewerStack.value[0]!.id)
        expect(runtime.chatRecordViewerStack.value[0]!.open).toBe(false)

        runtime.removeChatRecordViewer(runtime.chatRecordViewerStack.value[0]!.id)
        expect(runtime.chatRecordViewerStack.value).toEqual([])

        runtime.openChatRecordViewer(record)
        runtime.clearChatRecordViewers()
        expect(runtime.chatRecordViewerStack.value).toEqual([])
        expect(beginForwardSelection).not.toHaveBeenCalled()
    })

    it('copies record entries and falls back to toast on clipboard failure', async () => {
        const { message } = await import('ant-design-vue')
        const runtime = useChatWorkspaceRecords({
            getChatRecordPayload: () => null,
            beginForwardSelection: vi.fn(),
        })
        const imageEntry = {
            source_message_id: 2,
            sequence: 2,
            conversation_id: 12,
            message_type: 'image' as const,
            sender_name: 'Bob',
            sender_avatar: '',
            content: '',
            asset: {
                asset_reference_id: 5,
                display_name: '设计图.png',
                media_type: 'image',
                url: '/uploads/design.png',
            },
        }

        await runtime.handleCopyChatRecordEntry(imageEntry as never)

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('设计图.png\n/uploads/design.png')
        expect(message.success).toHaveBeenCalledWith('消息已复制')

        vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
        await runtime.handleCopyChatRecordEntry(imageEntry as never)

        expect(message.error).toHaveBeenCalledWith('复制失败')
    })

    it('forwards record entries with source ids and warns on unsupported entries', async () => {
        const { message } = await import('ant-design-vue')
        const beginForwardSelection = vi.fn()
        const runtime = useChatWorkspaceRecords({
            getChatRecordPayload: () => null,
            beginForwardSelection,
        })

        runtime.handleForwardChatRecordEntry({ source_message_id: 88 } as never)
        runtime.handleForwardChatRecordEntry({ source_message_id: 0 } as never)

        expect(beginForwardSelection).toHaveBeenCalledWith([88])
        expect(message.warning).toHaveBeenCalledWith('该条聊天记录暂不支持转发')
    })
})