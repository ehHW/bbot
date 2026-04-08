import type { ChatMessageItem } from '@/types/chat'

export function upsertMessageItem(items: ChatMessageItem[], nextMessage: ChatMessageItem) {
    const nextItems = [...items]
    const index = nextItems.findIndex((item) => item.id === nextMessage.id)
    if (index === -1) {
        nextItems.push(nextMessage)
        return nextItems.sort((left, right) => left.sequence - right.sequence)
    }
    nextItems.splice(index, 1, { ...nextItems[index], ...nextMessage })
    return nextItems
}

export function removeMessageByClientId(items: ChatMessageItem[], clientMessageId: string) {
    return items.filter((item) => String(item.payload?.client_message_id || '') !== clientMessageId)
}

export function mergeConversationMessages(
    currentItems: ChatMessageItem[],
    failedItems: ChatMessageItem[],
    serverItems: Array<ChatMessageItem & { client_message_id?: string | null }>,
) {
    const current = currentItems.filter((item) => {
        const localClientMessageId = String(item.payload?.client_message_id || '')
        if (!localClientMessageId || !item.local_status) {
            return true
        }
        return !serverItems.some((serverItem) => serverItem.client_message_id === localClientMessageId)
    })
    const persistedFailed = failedItems.filter((item) => {
        const localClientMessageId = String(item.payload?.client_message_id || '')
        return localClientMessageId && !serverItems.some((serverItem) => serverItem.client_message_id === localClientMessageId)
    })
    const merged = [...current]
    for (const item of persistedFailed) {
        const index = merged.findIndex((currentItem) => String(currentItem.payload?.client_message_id || '') === String(item.payload?.client_message_id || ''))
        if (index === -1) {
            merged.push(item)
        } else {
            merged.splice(index, 1, item)
        }
    }
    for (const item of serverItems) {
        const index = merged.findIndex((currentItem) => currentItem.id === item.id)
        if (index === -1) {
            merged.push(item)
        } else {
            merged.splice(index, 1, item)
        }
    }
    return merged.sort((left, right) => left.sequence - right.sequence)
}