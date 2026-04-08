import { message as antMessage } from 'ant-design-vue'
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import {
    createFriendRequestApi,
    createGroupConversationApi,
    deleteFriendApi,
    getAdminConversationsApi,
    getAdminMessagesApi,
    getConversationDetailApi,
    getConversationMembersApi,
    getConversationMessagesApi,
    getConversationsApi,
    getFriendRequestsApi,
    getFriendsApi,
    getGroupJoinRequestsApi,
    handleFriendRequestApi,
    handleGroupJoinRequestApi,
    hideConversationApi,
    inviteConversationMemberApi,
    leaveConversationApi,
    muteConversationMemberApi,
    openDirectConversationApi,
    readConversationApi,
    removeConversationMemberApi,
    searchChatApi,
    toggleConversationPinApi,
    updateConversationPreferenceApi,
    updateFriendSettingApi,
    updateGroupConfigApi,
    updateConversationMemberRoleApi,
} from '@/api/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import type {
    ChatConversationItem,
    ChatConversationMemberItem,
    ChatFriendRequestItem,
    ChatFriendshipItem,
    ChatGroupJoinRequestItem,
    ChatGroupNoticeItem,
    ChatMessageCursor,
    ChatMessageItem,
    ChatSearchResult,
    ChatUserBrief,
} from '@/types/chat'
import type { WebSocketMessage } from '@/utils/websocket'
import { globalWebSocket } from '@/utils/websocket'

type TypingTimer = ReturnType<typeof window.setTimeout>

function sortConversations(items: ChatConversationItem[], sortMode: 'recent' | 'unread') {
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

export const useChatStore = defineStore('chat', () => {
    const userStore = useUserStore()
    const settingsStore = useSettingsStore()
    const initialized = ref(false)
    const loading = ref(false)
    const loadingMessages = ref(false)
    const sending = ref(false)
    const conversations = ref<ChatConversationItem[]>([])
    const activeConversationId = ref<number | null>(null)
    const friends = ref<ChatFriendshipItem[]>([])
    const receivedRequests = ref<ChatFriendRequestItem[]>([])
    const sentRequests = ref<ChatFriendRequestItem[]>([])
    const seenPendingRequestIds = ref<number[]>([])
    const seenFriendNoticeIds = ref<number[]>([])
    const searchResult = ref<ChatSearchResult | null>(null)
    const adminConversations = ref<ChatConversationItem[]>([])
    const adminMessages = ref<(ChatMessageItem & { conversation_id: number })[]>([])
    const groupNoticeItems = ref<ChatGroupNoticeItem[]>([])
    const globalGroupJoinRequests = ref<ChatGroupJoinRequestItem[]>([])
    const contactGroupConversations = ref<ChatConversationItem[]>([])
    const failedMessageMap = ref<Record<number, ChatMessageItem[]>>({})
    const focusedSequenceMap = reactive<Record<number, number | null>>({})
    const messageMap = reactive<Record<number, ChatMessageItem[]>>({})
    const cursorMap = reactive<Record<number, ChatMessageCursor>>({})
    const memberMap = reactive<Record<number, ChatConversationMemberItem[]>>({})
    const joinRequestMap = reactive<Record<number, ChatGroupJoinRequestItem[]>>({})
    const typingMap = reactive<Record<number, ChatUserBrief[]>>({})
    const typingTimers = new Map<string, TypingTimer>()
    let sendingFallbackTimer: ReturnType<typeof window.setTimeout> | null = null
    let sendingSyncTimer: ReturnType<typeof window.setTimeout> | null = null
    let wsUnsubscribe: (() => void) | null = null

    const activeConversation = computed(() => conversations.value.find((item) => item.id === activeConversationId.value) || null)
    const activeMessages = computed(() => (activeConversationId.value ? messageMap[activeConversationId.value] || [] : []))
    const activeMembers = computed(() => (activeConversationId.value ? memberMap[activeConversationId.value] || [] : []))
    const activeJoinRequests = computed(() => (activeConversationId.value ? joinRequestMap[activeConversationId.value] || [] : []))
    const typingUsers = computed(() => (activeConversationId.value ? typingMap[activeConversationId.value] || [] : []))
    const totalUnreadCount = computed(() => conversations.value.reduce((total, item) => total + item.unread_count, 0))
    const isAuditAvailable = computed(() => userStore.hasPermission('chat.review_all_messages') && settingsStore.chatStealthInspectEnabled)
    const unreadFriendNoticeCount = computed(() => {
        const seen = new Set(seenFriendNoticeIds.value)
        return receivedRequests.value.filter((item) => item.status !== 'pending' && !seen.has(item.id)).length
            + sentRequests.value.filter((item) => item.status !== 'pending' && !seen.has(item.id)).length
    })
    const unreadPendingFriendRequestCount = computed(() => {
        const seen = new Set(seenPendingRequestIds.value)
        return receivedRequests.value.filter((item) => item.status === 'pending' && !seen.has(item.id)).length
    })

    const clearSendingState = () => {
        sending.value = false
        if (sendingFallbackTimer) {
            window.clearTimeout(sendingFallbackTimer)
            sendingFallbackTimer = null
        }
        if (sendingSyncTimer) {
            window.clearTimeout(sendingSyncTimer)
            sendingSyncTimer = null
        }
    }

    const appendGroupNotice = (notice: ChatGroupNoticeItem) => {
        groupNoticeItems.value = [notice, ...groupNoticeItems.value.filter((item) => item.id !== notice.id)].slice(0, 100)
    }

    const sortCurrentConversations = () => {
        conversations.value = sortConversations(conversations.value, settingsStore.chatListSortMode)
    }

    const upsertConversation = (nextConversation: ChatConversationItem) => {
        const index = conversations.value.findIndex((item) => item.id === nextConversation.id)
        if (index === -1) {
            conversations.value = [nextConversation, ...conversations.value]
            sortCurrentConversations()
            return
        }
        conversations.value.splice(index, 1, { ...conversations.value[index], ...nextConversation })
        sortCurrentConversations()
    }

    const syncConversationPreview = (conversationId: number, messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>) => {
        const conversation = conversations.value.find((item) => item.id === conversationId)
        if (!conversation) {
            return
        }
        conversation.last_message_preview = String(messageItem.content || '').trim() || conversation.last_message_preview
        conversation.last_message_at = messageItem.created_at || conversation.last_message_at
        if (!conversation.show_in_list) {
            conversation.show_in_list = true
        }
        sortCurrentConversations()
    }

    const syncFriendRemarkLocally = (friendUserId: number, remark: string) => {
        friends.value = friends.value.map((item) => (item.friend_user.id === friendUserId ? { ...item, remark } : item))
        conversations.value = conversations.value.map((item) => {
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

    const getLastSequence = (conversationId: number) => {
        const items = messageMap[conversationId] || []
        const lastItem = items.at(-1)
        return lastItem ? Number(lastItem.sequence) : 0
    }

    const removeLocalMessageByClientId = (conversationId: number, clientMessageId: string) => {
        const items = messageMap[conversationId] || []
        messageMap[conversationId] = items.filter((item) => String(item.payload?.client_message_id || '') !== clientMessageId)
        const failedItems = failedMessageMap.value[conversationId] || []
        failedMessageMap.value = {
            ...failedMessageMap.value,
            [conversationId]: failedItems.filter((item) => String(item.payload?.client_message_id || '') !== clientMessageId),
        }
    }

    const upsertFailedMessage = (conversationId: number, messageItem: ChatMessageItem) => {
        const failedItems = failedMessageMap.value[conversationId] || []
        const next = failedItems.filter((item) => String(item.payload?.client_message_id || '') !== String(messageItem.payload?.client_message_id || ''))
        next.push({ ...messageItem, local_status: 'failed' })
        failedMessageMap.value = {
            ...failedMessageMap.value,
            [conversationId]: next.sort((left, right) => left.sequence - right.sequence),
        }
    }

    const updateLocalMessageStatus = (conversationId: number, clientMessageId: string, status: 'sending' | 'failed', error?: string) => {
        const items = messageMap[conversationId] || []
        messageMap[conversationId] = items.map((item) => {
            if (String(item.payload?.client_message_id || '') !== clientMessageId) {
                return item
            }
            return {
                ...item,
                local_status: status,
                local_error: error || null,
            }
        })
        const target = (messageMap[conversationId] || []).find((item) => String(item.payload?.client_message_id || '') === clientMessageId)
        if (!target) {
            return
        }
        if (status === 'failed') {
            upsertFailedMessage(conversationId, target)
            return
        }
        const failedItems = failedMessageMap.value[conversationId] || []
        failedMessageMap.value = {
            ...failedMessageMap.value,
            [conversationId]: failedItems.filter((item) => String(item.payload?.client_message_id || '') !== clientMessageId),
        }
    }

    const insertLocalMessage = (conversationId: number, content: string, clientMessageId: string, status: 'sending' | 'failed', error?: string) => {
        const tempMessage: ChatMessageItem = {
            id: -Date.now(),
            sequence: getLastSequence(conversationId) + 0.01,
            message_type: 'text',
            content,
            payload: { client_message_id: clientMessageId },
            is_system: false,
            sender: userStore.user
                ? {
                    id: userStore.user.id,
                    username: userStore.user.username,
                    display_name: userStore.user.display_name,
                    avatar: userStore.user.avatar,
                }
                : null,
            created_at: new Date().toISOString(),
            local_status: status,
            local_error: error || null,
        }
        const items = messageMap[conversationId] || []
        messageMap[conversationId] = [...items, tempMessage]
        if (status === 'failed') {
            upsertFailedMessage(conversationId, tempMessage)
        }
        const conversation = conversations.value.find((item) => item.id === conversationId)
        if (conversation) {
            conversation.last_message_preview = content
            conversation.last_message_at = tempMessage.created_at
            if (!conversation.show_in_list) {
                conversation.show_in_list = true
            }
            sortCurrentConversations()
        }
    }

    const reconcileLocalMessage = (conversationId: number, clientMessageId: string | null | undefined, nextMessage: ChatMessageItem) => {
        if (clientMessageId) {
            removeLocalMessageByClientId(conversationId, clientMessageId)
        }
        upsertMessage(conversationId, { ...nextMessage, local_status: null, local_error: null })
    }

    const markLatestSendingMessageFailed = (conversationId: number | null, error: string) => {
        if (!conversationId) {
            return
        }
        const items = messageMap[conversationId] || []
        const target = [...items].reverse().find((item) => item.local_status === 'sending')
        const clientMessageId = String(target?.payload?.client_message_id || '')
        if (!clientMessageId) {
            return
        }
        updateLocalMessageStatus(conversationId, clientMessageId, 'failed', error)
    }

    const setConversationUnread = (conversationId: number, unreadCount: number, lastReadSequence?: number) => {
        const target = conversations.value.find((item) => item.id === conversationId)
        if (!target) {
            return
        }
        target.unread_count = unreadCount
        if (typeof lastReadSequence === 'number') {
            target.last_read_sequence = lastReadSequence
        }
    }

    const upsertMessage = (conversationId: number, nextMessage: ChatMessageItem) => {
        const items = messageMap[conversationId] || []
        const index = items.findIndex((item) => item.id === nextMessage.id)
        if (index === -1) {
            messageMap[conversationId] = [...items, nextMessage].sort((left, right) => left.sequence - right.sequence)
            return
        }
        items.splice(index, 1, { ...items[index], ...nextMessage })
        messageMap[conversationId] = [...items]
    }

    const removeTypingUser = (conversationId: number, userId: number) => {
        const current = typingMap[conversationId] || []
        typingMap[conversationId] = current.filter((item) => item.id !== userId)
    }

    const handleTypingPayload = (payload: WebSocketMessage) => {
        const conversationId = Number(payload.conversation_id)
        const user = payload.user as ChatUserBrief | undefined
        if (!conversationId || !user || user.id === userStore.user?.id) {
            return
        }
        if (!payload.is_typing) {
            removeTypingUser(conversationId, user.id)
            return
        }
        const key = `${conversationId}:${user.id}`
        const current = typingMap[conversationId] || []
        if (!current.some((item) => item.id === user.id)) {
            typingMap[conversationId] = [...current, user]
        }
        const previousTimer = typingTimers.get(key)
        if (previousTimer) {
            window.clearTimeout(previousTimer)
        }
        typingTimers.set(
            key,
            window.setTimeout(() => {
                removeTypingUser(conversationId, user.id)
                typingTimers.delete(key)
            }, 3000),
        )
    }

    const handleSocketMessage = async (payload: WebSocketMessage) => {
        if (!payload || typeof payload.type !== 'string') {
            return
        }
        if (payload.type === 'error') {
            antMessage.error(String(payload.message || '聊天操作失败'))
            markLatestSendingMessageFailed(activeConversationId.value, String(payload.message || '发送失败'))
            clearSendingState()
            return
        }
        if (payload.type === 'chat_message_ack') {
            const conversation = payload.conversation as ChatConversationItem | undefined
            const nextMessage = payload.message as ChatMessageItem | undefined
            const clientMessageId = typeof payload.client_message_id === 'string' ? payload.client_message_id : undefined
            if (conversation) {
                upsertConversation(conversation)
            }
            if (conversation && nextMessage) {
                reconcileLocalMessage(conversation.id, clientMessageId, nextMessage)
                syncConversationPreview(conversation.id, nextMessage)
            }
            clearSendingState()
            return
        }
        if (payload.type === 'chat_new_message') {
            const conversationId = Number(payload.conversation_id)
            const nextMessage = payload.message as ChatMessageItem | undefined
            if (conversationId && nextMessage) {
                upsertMessage(conversationId, { ...nextMessage, local_status: null, local_error: null })
                syncConversationPreview(conversationId, nextMessage)
                if (nextMessage.sender?.id === userStore.user?.id) {
                    clearSendingState()
                }
                if (activeConversationId.value === conversationId && document.visibilityState === 'visible') {
                    await markConversationRead(conversationId, nextMessage.sequence)
                }
            }
            return
        }
        if (payload.type === 'chat_conversation_updated') {
            const conversation = payload.conversation as ChatConversationItem | undefined
            if (conversation) {
                upsertConversation(conversation)
            }
            return
        }
        if (payload.type === 'chat_unread_updated') {
            setConversationUnread(Number(payload.conversation_id), Number(payload.unread_count || 0), Number(payload.last_read_sequence || 0) || undefined)
            return
        }
        if (payload.type === 'chat_friend_request_updated') {
            await loadFriendRequests()
            return
        }
        if (payload.type === 'chat_friendship_updated') {
            const action = String(payload.action || '')
            if (action === 'updated') {
                return
            }
            await Promise.all([loadFriends(), loadConversations()])
            return
        }
        if (payload.type === 'chat_group_join_request_updated') {
            const joinRequest = payload.join_request as ChatGroupJoinRequestItem | undefined
            if (joinRequest?.conversation_id) {
                await loadJoinRequests(joinRequest.conversation_id)
            }
            await loadGlobalGroupJoinRequests()
            return
        }
        if (payload.type === 'chat_typing') {
            handleTypingPayload(payload)
            return
        }
        if (payload.type === 'system_notice' && payload.category === 'chat' && payload.message) {
            const noticePayload = (payload.payload || {}) as Record<string, unknown>
            appendGroupNotice({
                id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                conversation_id: typeof noticePayload.conversation_id === 'number' ? noticePayload.conversation_id : null,
                message: String(payload.message),
                created_at: new Date().toISOString(),
                payload: noticePayload,
            })
            antMessage.info(String(payload.message))
        }
    }

    const ensureWsSubscription = () => {
        if (wsUnsubscribe) {
            return
        }
        wsUnsubscribe = globalWebSocket.subscribe((payload) => {
            void handleSocketMessage(payload)
        })
    }

    const loadConversations = async (sortMode: 'recent' | 'unread' = 'recent') => {
        loading.value = true
        try {
            const { data } = await getConversationsApi()
            conversations.value = sortConversations(data.results, sortMode)
            const firstConversation = conversations.value[0]
            if (!activeConversationId.value && firstConversation) {
                activeConversationId.value = firstConversation.id
            }
        } finally {
            loading.value = false
        }
    }

    const loadContactGroupConversations = async () => {
        const { data } = await getConversationsApi({ category: 'group', include_hidden: true })
        contactGroupConversations.value = data.results
    }

    const loadFriends = async () => {
        const { data } = await getFriendsApi()
        friends.value = data.results
    }

    const loadFriendRequests = async () => {
        const [received, sent] = await Promise.all([
            getFriendRequestsApi({ direction: 'received' }),
            getFriendRequestsApi({ direction: 'sent' }),
        ])
        receivedRequests.value = received.data.results
        sentRequests.value = sent.data.results
        const validIds = new Set([...received.data.results, ...sent.data.results].map((item) => item.id))
        seenFriendNoticeIds.value = seenFriendNoticeIds.value.filter((id) => validIds.has(id))
        const validPendingReceivedIds = new Set(received.data.results.filter((item) => item.status === 'pending').map((item) => item.id))
        seenPendingRequestIds.value = seenPendingRequestIds.value.filter((id) => validPendingReceivedIds.has(id))
    }

    const markPendingRequestsSeen = (requestIds: number[]) => {
        if (!requestIds.length) {
            return
        }
        const seen = new Set(seenPendingRequestIds.value)
        for (const id of requestIds) {
            seen.add(id)
        }
        seenPendingRequestIds.value = [...seen]
    }

    const markFriendNoticesSeen = (requestIds: number[]) => {
        if (!requestIds.length) {
            return
        }
        const seen = new Set(seenFriendNoticeIds.value)
        for (const id of requestIds) {
            seen.add(id)
        }
        seenFriendNoticeIds.value = [...seen]
    }

    const loadGlobalGroupJoinRequests = async () => {
        const { data } = await getGroupJoinRequestsApi({ status: 'pending' })
        globalGroupJoinRequests.value = data.results
    }

    const loadMessages = async (conversationId: number, params?: { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }) => {
        loadingMessages.value = true
        try {
            const { data } = await getConversationMessagesApi(conversationId, params)
            const current = (messageMap[conversationId] || []).filter((item) => {
                const localClientMessageId = String(item.payload?.client_message_id || '')
                if (!localClientMessageId || !item.local_status) {
                    return true
                }
                return !data.items.some((serverItem) => serverItem.client_message_id === localClientMessageId)
            })
            const persistedFailed = (failedMessageMap.value[conversationId] || []).filter((item) => {
                const localClientMessageId = String(item.payload?.client_message_id || '')
                return localClientMessageId && !data.items.some((serverItem) => serverItem.client_message_id === localClientMessageId)
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
            for (const item of data.items) {
                const index = merged.findIndex((currentItem) => currentItem.id === item.id)
                if (index === -1) {
                    merged.push(item)
                } else {
                    merged.splice(index, 1, item)
                }
            }
            messageMap[conversationId] = merged.sort((left, right) => left.sequence - right.sequence)
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

    const selectConversation = async (conversationId: number, options?: { focusSequence?: number }) => {
        activeConversationId.value = conversationId
        const focusSequence = options?.focusSequence
        focusedSequenceMap[conversationId] = focusSequence ?? null
        await loadMessages(conversationId, focusSequence ? { around_sequence: focusSequence, limit: 30 } : undefined)
    }

    const loadOlderMessages = async (conversationId: number) => {
        const cursor = cursorMap[conversationId]
        if (!cursor?.has_more_before || !cursor.before_sequence) {
            return
        }
        await loadMessages(conversationId, { before_sequence: cursor.before_sequence, limit: 30 })
    }

    const markConversationRead = async (conversationId: number, lastReadSequence: number) => {
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

    const sendTextMessage = async (content: string) => {
        if (!activeConversation.value) {
            throw new Error('请先选择会话')
        }
        const text = content.trim()
        if (!text) {
            throw new Error('消息不能为空')
        }
        if (!globalWebSocket.connected.value) {
            throw new Error('WebSocket 未连接，当前无法发送消息')
        }
        const clientMessageId = `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`
        const directConversationDeletedFriend =
            activeConversation.value.type === 'direct' && !friends.value.some((item) => item.direct_conversation?.id === activeConversation.value?.id)
        if (directConversationDeletedFriend) {
            insertLocalMessage(activeConversation.value.id, text, clientMessageId, 'failed', '你们已不是好友，当前私聊消息发送失败')
            throw new Error('你们已不是好友，当前私聊消息发送失败')
        }
        insertLocalMessage(activeConversation.value.id, text, clientMessageId, 'sending')
        sending.value = true
        if (sendingFallbackTimer) {
            window.clearTimeout(sendingFallbackTimer)
        }
        sendingFallbackTimer = window.setTimeout(() => {
            updateLocalMessageStatus(activeConversation.value?.id || 0, clientMessageId, 'failed', '发送超时，请重试')
            clearSendingState()
        }, 12000)
        const sent = globalWebSocket.send({
            type: 'chat_send_message',
            conversation_id: activeConversation.value.id,
            content: text,
            client_message_id: clientMessageId,
        })
        if (!sent) {
            updateLocalMessageStatus(activeConversation.value.id, clientMessageId, 'failed', '消息发送失败，WebSocket 未就绪')
            clearSendingState()
            throw new Error('消息发送失败，WebSocket 未就绪')
        }
        sendingSyncTimer = window.setTimeout(() => {
            const currentConversationId = activeConversation.value?.id
            if (!currentConversationId) {
                clearSendingState()
                return
            }
            void loadMessages(currentConversationId)
                .catch(() => undefined)
                .finally(() => {
                    updateLocalMessageStatus(currentConversationId, clientMessageId, 'failed', '发送状态未知，请重试')
                    clearSendingState()
                })
        }, 1500)
    }

    const retryMessage = async (messageItem: ChatMessageItem) => {
        const conversationId = activeConversation.value?.id
        const retryContent = messageItem.content.trim()
        const clientMessageId = String(messageItem.payload?.client_message_id || '')
        if (!conversationId || !clientMessageId || !retryContent) {
            return
        }
        updateLocalMessageStatus(conversationId, clientMessageId, 'sending')
        try {
            const directConversationDeletedFriend =
                activeConversation.value?.type === 'direct' && !friends.value.some((item) => item.direct_conversation?.id === activeConversation.value?.id)
            if (directConversationDeletedFriend) {
                updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '你们已不是好友，当前私聊消息发送失败')
                throw new Error('你们已不是好友，当前私聊消息发送失败')
            }
            const sent = globalWebSocket.send({
                type: 'chat_send_message',
                conversation_id: conversationId,
                content: retryContent,
                client_message_id: clientMessageId,
            })
            if (!sent) {
                updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '消息发送失败，WebSocket 未就绪')
                throw new Error('消息发送失败，WebSocket 未就绪')
            }
        } catch (error) {
            throw error
        }
    }

    const toggleConversationPin = async (conversationId: number, isPinned: boolean) => {
        const { data } = await toggleConversationPinApi(conversationId, isPinned)
        upsertConversation(data.conversation)
    }

    const sendTyping = (isTyping: boolean) => {
        if (!activeConversation.value || !globalWebSocket.connected.value) {
            return
        }
        globalWebSocket.send({
            type: 'chat_typing',
            conversation_id: activeConversation.value.id,
            is_typing: isTyping,
        })
    }

    const hideConversation = async (conversationId: number) => {
        await hideConversationApi(conversationId)
        conversations.value = conversations.value.filter((item) => item.id !== conversationId)
        contactGroupConversations.value = contactGroupConversations.value.map((item) => (item.id === conversationId ? { ...item, show_in_list: false } : item))
        if (activeConversationId.value === conversationId) {
            activeConversationId.value = conversations.value[0]?.id || null
        }
    }

    const openDirectConversation = async (targetUserId: number) => {
        const { data } = await openDirectConversationApi(targetUserId)
        await loadConversations()
        await loadContactGroupConversations()
        await loadFriends()
        await selectConversation(data.conversation.id)
    }

    const createGroupConversation = async (payload: {
        name: string
        member_user_ids: number[]
        join_approval_required: boolean
        allow_member_invite: boolean
    }) => {
        const { data } = await createGroupConversationApi(payload)
        await loadConversations()
        await loadContactGroupConversations()
        await selectConversation(data.conversation.id)
    }

    const updateGroupConfig = async (
        conversationId: number,
        payload: { name?: string; avatar?: string; join_approval_required?: boolean; allow_member_invite?: boolean; max_members?: number | null; mute_all?: boolean },
    ) => {
        const { data } = await updateGroupConfigApi(conversationId, payload)
        const target = conversations.value.find((item) => item.id === conversationId)
        if (target && target.group_config) {
            target.group_config = {
                ...target.group_config,
                ...data.group_config,
            }
        }
        upsertConversation(data.conversation)
        return data.group_config
    }

    const updateConversationPreferences = async (conversationId: number, payload: { mute_notifications?: boolean; group_nickname?: string }) => {
        const { data } = await updateConversationPreferenceApi(conversationId, payload)
        upsertConversation(data.conversation)
        return data.member_settings
    }

    const setFocusedSequence = (conversationId: number, sequence: number | null) => {
        focusedSequenceMap[conversationId] = sequence
    }

    const clearFocusedSequence = (conversationId: number) => {
        focusedSequenceMap[conversationId] = null
    }

    const loadMembers = async (conversationId: number) => {
        const conversation = conversations.value.find((item) => item.id === conversationId)
        if (conversation?.type !== 'group') {
            memberMap[conversationId] = []
            return
        }
        const { data } = await getConversationMembersApi(conversationId)
        memberMap[conversationId] = data.items
    }

    const inviteMember = async (conversationId: number, targetUserId: number) => {
        await inviteConversationMemberApi(conversationId, targetUserId)
        await Promise.all([loadMembers(conversationId), loadJoinRequests(conversationId), loadConversations()])
        await loadContactGroupConversations()
    }

    const removeMember = async (conversationId: number, userId: number) => {
        await removeConversationMemberApi(conversationId, userId)
        await Promise.all([loadMembers(conversationId), loadConversations()])
        await loadContactGroupConversations()
    }

    const updateMemberRole = async (conversationId: number, userId: number, role: 'admin' | 'member') => {
        await updateConversationMemberRoleApi(conversationId, userId, role)
        await loadMembers(conversationId)
    }

    const muteMember = async (conversationId: number, userId: number, muteMinutes: number, reason?: string) => {
        await muteConversationMemberApi(conversationId, userId, muteMinutes, reason)
        await loadMembers(conversationId)
    }

    const leaveConversation = async (conversationId: number) => {
        await leaveConversationApi(conversationId)
        await loadConversations()
        await loadContactGroupConversations()
    }

    const loadJoinRequests = async (conversationId: number) => {
        const { data } = await getGroupJoinRequestsApi({ conversation_id: conversationId })
        joinRequestMap[conversationId] = data.results
    }

    const handleJoinRequest = async (requestId: number, action: 'approve' | 'reject' | 'cancel', conversationId: number) => {
        await handleGroupJoinRequestApi(requestId, { action })
        await Promise.all([loadJoinRequests(conversationId), loadMembers(conversationId), loadConversations()])
    }

    const submitFriendRequest = async (toUserId: number, requestMessage?: string) => {
        await createFriendRequestApi({ to_user_id: toUserId, request_message: requestMessage })
        await loadFriendRequests()
    }

    const handleFriendRequest = async (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
        await handleFriendRequestApi(requestId, action)
        await Promise.allSettled([loadFriendRequests(), loadFriends(), loadConversations(), loadContactGroupConversations()])
    }

    const removeFriend = async (friendUserId: number) => {
        await deleteFriendApi(friendUserId)
        await Promise.allSettled([loadFriends(), loadConversations()])
    }

    const updateFriendRemark = async (friendUserId: number, remark: string) => {
        const { data } = await updateFriendSettingApi(friendUserId, { remark })
        syncFriendRemarkLocally(friendUserId, data.remark)
    }

    const runSearch = async (keyword: string) => {
        const { data } = await searchChatApi({ keyword, limit: 10 })
        searchResult.value = data
    }

    const loadAuditData = async (keyword = '', conversationId?: number) => {
        if (!isAuditAvailable.value) {
            adminConversations.value = []
            adminMessages.value = []
            return
        }
        const [conversationResponse, messageResponse] = await Promise.all([
            getAdminConversationsApi({ keyword: keyword || undefined }),
            getAdminMessagesApi({ keyword: keyword || undefined, conversation_id: conversationId }),
        ])
        adminConversations.value = conversationResponse.data.results
        adminMessages.value = messageResponse.data.results
    }

    const initialize = async (sortMode: 'recent' | 'unread' = 'recent') => {
        clearSendingState()
        ensureWsSubscription()
        await Promise.all([loadConversations(sortMode), loadFriends(), loadFriendRequests(), loadGlobalGroupJoinRequests(), loadContactGroupConversations()])
        initialized.value = true
        if (activeConversationId.value) {
            await loadMessages(activeConversationId.value)
        }
    }

    const reset = () => {
        conversations.value = []
        friends.value = []
        receivedRequests.value = []
        sentRequests.value = []
        seenPendingRequestIds.value = []
        seenFriendNoticeIds.value = []
        searchResult.value = null
        adminConversations.value = []
        adminMessages.value = []
        groupNoticeItems.value = []
        globalGroupJoinRequests.value = []
        contactGroupConversations.value = []
        failedMessageMap.value = {}
        activeConversationId.value = null
        for (const key of Object.keys(messageMap)) {
            delete messageMap[Number(key)]
        }
        for (const key of Object.keys(cursorMap)) {
            delete cursorMap[Number(key)]
        }
        for (const key of Object.keys(memberMap)) {
            delete memberMap[Number(key)]
        }
        for (const key of Object.keys(joinRequestMap)) {
            delete joinRequestMap[Number(key)]
        }
        for (const key of Object.keys(typingMap)) {
            delete typingMap[Number(key)]
        }
        for (const key of Object.keys(focusedSequenceMap)) {
            delete focusedSequenceMap[Number(key)]
        }
        typingTimers.forEach((timer) => window.clearTimeout(timer))
        typingTimers.clear()
        clearSendingState()
        initialized.value = false
    }

    return {
        initialized,
        loading,
        loadingMessages,
        sending,
        conversations,
        activeConversationId,
        activeConversation,
        activeMessages,
        activeMembers,
        activeJoinRequests,
        typingUsers,
        totalUnreadCount,
        friends,
        receivedRequests,
        sentRequests,
        seenPendingRequestIds,
        seenFriendNoticeIds,
        searchResult,
        adminConversations,
        adminMessages,
        groupNoticeItems,
        globalGroupJoinRequests,
        contactGroupConversations,
        failedMessageMap,
        focusedSequenceMap,
        isAuditAvailable,
        unreadPendingFriendRequestCount,
        unreadFriendNoticeCount,
        initialize,
        reset,
        loadConversations,
        loadMessages,
        loadOlderMessages,
        loadMembers,
        loadJoinRequests,
        loadFriendRequests,
        loadFriends,
        loadGlobalGroupJoinRequests,
        loadContactGroupConversations,
        loadAuditData,
        markPendingRequestsSeen,
        markFriendNoticesSeen,
        selectConversation,
        sendTextMessage,
        sendTyping,
        markConversationRead,
        hideConversation,
        toggleConversationPin,
        openDirectConversation,
        createGroupConversation,
        updateGroupConfig,
        updateConversationPreferences,
        setFocusedSequence,
        clearFocusedSequence,
        inviteMember,
        removeMember,
        updateMemberRole,
        muteMember,
        leaveConversation,
        handleJoinRequest,
        submitFriendRequest,
        handleFriendRequest,
        removeFriend,
        updateFriendRemark,
        retryMessage,
        runSearch,
    }
}, {
    persist: true,
})