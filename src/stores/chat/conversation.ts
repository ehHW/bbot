import type { ChatConversationItem, ChatMessageItem } from '@/types/chat'

export function sortConversations(items: ChatConversationItem[], sortMode: 'recent' | 'unread') {
    return [...items].sort((left, right) => {
        if (left.is_pinned !== right.is_pinned) {
            return left.is_pinned ? -1 : 1
        }
        if (sortMode === 'unread' && left.unread_count !== right.unread_count) {
            return right.unread_count - left.unread_count
        }
        const leftTs = left.last_message_at ? new Date(left.last_message_at).getTime() : 0
        const rightTs = right.last_message_at ? new Date(right.last_message_at).getTime() : 0
        if (leftTs !== rightTs) {
            return rightTs - leftTs
        }
        return right.id - left.id
    })
}

export function upsertConversationItem(items: ChatConversationItem[], nextConversation: ChatConversationItem, sortMode: 'recent' | 'unread') {
    const nextItems = [...items]
    const index = nextItems.findIndex((item) => item.id === nextConversation.id)
    if (index === -1) {
        nextItems.unshift(nextConversation)
        return sortConversations(nextItems, sortMode)
    }
    nextItems.splice(index, 1, { ...nextItems[index], ...nextConversation })
    return sortConversations(nextItems, sortMode)
}

export function syncConversationPreviewInList(
    items: ChatConversationItem[],
    conversationId: number,
    messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>,
    sortMode: 'recent' | 'unread',
) {
    const nextItems = [...items]
    const target = nextItems.find((item) => item.id === conversationId)
    if (!target) {
        return nextItems
    }
    target.last_message_preview = String(messageItem.content || '').trim() || target.last_message_preview
    target.last_message_at = messageItem.created_at || target.last_message_at
    if (!target.show_in_list) {
        target.show_in_list = true
    }
    return sortConversations(nextItems, sortMode)
}

export function syncFriendRemarkInConversations(items: ChatConversationItem[], friendUserId: number, remark: string) {
    return items.map((item) => {
        if (item.type !== 'direct') {
            return item
        }
        const directTargetId = item.direct_target?.id
        if (directTargetId !== friendUserId) {
            return item
        }
        return {
            ...item,
            friend_remark: remark || null,
        }
    })
}

export function setConversationUnreadInList(
    items: ChatConversationItem[],
    conversationId: number,
    unreadCount: number,
    lastReadSequence?: number,
) {
    const target = items.find((item) => item.id === conversationId)
    if (!target) {
        return false
    }
    target.unread_count = unreadCount
    if (typeof lastReadSequence === 'number') {
        target.last_read_sequence = lastReadSequence
    }
    return true
}