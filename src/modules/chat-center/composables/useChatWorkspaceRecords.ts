import { message } from 'ant-design-vue'
import { ref } from 'vue'
import {
    buildChatComposerAssetClipboardDataFromRecordEntry,
} from '@/modules/chat-center/utils/chatAssetPrepare'
import type { ChatMessageItem, ChatMessageRecordItem, ChatMessageRecordPayload } from '@/types/chat'
import { trimText } from '@/validators/common'

export type ChatRecordViewerState = {
    id: number
    open: boolean
    record: ChatMessageRecordPayload
}

export function useChatWorkspaceRecords(options: {
    getChatRecordPayload: (messageItem: ChatMessageItem) => ChatMessageRecordPayload | null
    beginForwardSelection: (messageIds: number[]) => void
}) {
    const chatRecordViewerStack = ref<ChatRecordViewerState[]>([])
    let chatRecordViewerSeed = 0

    const buildChatRecordPlainText = (record: ChatMessageRecordPayload | null) => {
        if (!record) {
            return '聊天记录'
        }
        const lines = (record.items || []).map((entry) => {
            if (entry.message_type === 'image') {
                return `${entry.sender_name}: [图片]`
            }
            if (entry.message_type === 'file') {
                return `${entry.sender_name}: [文件]`
            }
            if (entry.message_type === 'chat_record') {
                return `${entry.sender_name}: [聊天记录]`
            }
            return `${entry.sender_name}: ${trimText((entry.content || '').replace(/\s+/g, ' ')) || '空消息'}`
        })
        return [record.title || '聊天记录', ...lines].join('\n')
    }

    const openChatRecordViewer = (record: ChatMessageRecordPayload) => {
        chatRecordViewerSeed += 1
        chatRecordViewerStack.value = [...chatRecordViewerStack.value, { id: chatRecordViewerSeed, open: true, record }]
    }

    const openChatRecordViewerFromMessage = (messageItem: ChatMessageItem) => {
        const record = options.getChatRecordPayload(messageItem)
        if (!record) {
            return
        }
        openChatRecordViewer(record)
    }

    const closeChatRecordViewer = (viewerId: number) => {
        chatRecordViewerStack.value = chatRecordViewerStack.value.map((viewer) => (viewer.id === viewerId ? { ...viewer, open: false } : viewer))
    }

    const removeChatRecordViewer = (viewerId: number) => {
        chatRecordViewerStack.value = chatRecordViewerStack.value.filter((viewer) => viewer.id !== viewerId)
    }

    const buildChatRecordEntryCopyText = (entry: ChatMessageRecordItem) => {
        if (entry.message_type === 'chat_record') {
            return buildChatRecordPlainText(entry.chat_record || null)
        }
        if (entry.message_type === 'image') {
            return buildChatComposerAssetClipboardDataFromRecordEntry(entry, {
                tokenId: `record_${entry.source_message_id || Date.now()}`,
            })?.text || [entry.asset?.display_name || '[图片]', entry.asset?.url || ''].filter(Boolean).join('\n')
        }
        if (entry.message_type === 'file') {
            return buildChatComposerAssetClipboardDataFromRecordEntry(entry, {
                tokenId: `record_${entry.source_message_id || Date.now()}`,
            })?.text || [entry.asset?.display_name || '[文件]', entry.asset?.url || ''].filter(Boolean).join('\n')
        }
        return entry.content || '空消息'
    }

    const handleCopyChatRecordEntry = async (entry: ChatMessageRecordItem) => {
        try {
            const clipboardData = buildChatComposerAssetClipboardDataFromRecordEntry(entry, {
                tokenId: `record_${entry.source_message_id || Date.now()}`,
            })
            if (clipboardData?.html && 'ClipboardItem' in window && navigator.clipboard.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([buildChatRecordEntryCopyText(entry)], { type: 'text/plain' }),
                        'text/html': new Blob([clipboardData.html], { type: 'text/html' }),
                    }),
                ])
                message.success('消息已复制')
                return
            }
            await navigator.clipboard.writeText(buildChatRecordEntryCopyText(entry))
            message.success('消息已复制')
        } catch {
            message.error('复制失败')
        }
    }

    const handleForwardChatRecordEntry = (entry: ChatMessageRecordItem) => {
        if (!entry.source_message_id) {
            message.warning('该条聊天记录暂不支持转发')
            return
        }
        options.beginForwardSelection([entry.source_message_id])
    }

    const clearChatRecordViewers = () => {
        chatRecordViewerStack.value = []
    }

    return {
        chatRecordViewerStack,
        buildChatRecordPlainText,
        openChatRecordViewer,
        openChatRecordViewerFromMessage,
        closeChatRecordViewer,
        removeChatRecordViewer,
        handleCopyChatRecordEntry,
        handleForwardChatRecordEntry,
        clearChatRecordViewers,
    }
}
