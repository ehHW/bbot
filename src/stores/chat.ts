import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import {
    getConversationsApi,
    getGroupJoinRequestsApi,
    hideConversationApi,
    toggleConversationPinApi,
} from '@/api/chat'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import {
    setConversationUnreadInList,
    sortConversations,
    syncConversationPreviewInList,
    syncFriendRemarkInConversations,
    upsertConversationItem,
} from '@/stores/chat/conversation'
import { removeMessageByClientId, upsertMessageItem } from '@/stores/chat/message'
import {
    loadMessagesAction,
    loadOlderMessagesAction,
    markConversationReadAction,
    retryMessageAction,
    sendAssetMessageAction,
    sendTextMessageAction,
} from '@/stores/chat/messageActions'
import {
    loadFriendRequestsAction,
    loadFriendsAction,
    markSeenIdsAction,
} from '@/stores/chat/friendshipActions'
import {
    loadJoinRequestsAction,
    loadMembersAction,
} from '@/stores/chat/groupActions'
import {
    createGroupConversationScene,
    openDirectConversationScene,
    updateConversationPreferencesScene,
    updateGroupConfigScene,
} from '@/stores/chat/conversationScenes'
import {
    handleFriendRequestScene,
    removeFriendScene,
    submitFriendRequestScene,
    updateFriendRemarkScene,
} from '@/stores/chat/friendshipScenes'
import {
    handleJoinRequestScene,
    inviteMemberScene,
    leaveConversationScene,
    muteMemberScene,
    removeMemberScene,
    updateMemberRoleScene,
} from '@/stores/chat/groupScenes'
import { initializeChatLifecycle, resetChatLifecycle } from '@/stores/chat/lifecycle'
import { createChatRealtimeHandler, ensureChatRealtimeSubscription } from '@/stores/chat/realtime'
import { loadAuditDataScene, runSearchScene } from '@/stores/chat/searchAudit'
import type {
    ChatConversationItem,
    ChatConversationMemberItem,
    ChatFriendRequestItem,
    ChatFriendshipItem,
    ChatGroupJoinRequestItem,
    ChatGroupNoticeItem,
    ChatMessageAssetPayload,
    ChatMessageCursor,
    ChatMessageItem,
    ChatSearchResult,
    ChatUserBrief,
} from '@/types/chat'
import { globalWebSocket } from '@/utils/websocket'

type TypingTimer = ReturnType<typeof setTimeout>

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
    const sendingFallbackTimer = ref<ReturnType<typeof setTimeout> | null>(null)
    const sendingSyncTimer = ref<ReturnType<typeof setTimeout> | null>(null)
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
        if (sendingFallbackTimer.value) {
            window.clearTimeout(sendingFallbackTimer.value)
            sendingFallbackTimer.value = null
        }
        if (sendingSyncTimer.value) {
            window.clearTimeout(sendingSyncTimer.value)
            sendingSyncTimer.value = null
        }
    }

    const appendGroupNotice = (notice: ChatGroupNoticeItem) => {
        groupNoticeItems.value = [notice, ...groupNoticeItems.value.filter((item) => item.id !== notice.id)].slice(0, 100)
    }

    const sortCurrentConversations = () => {
        conversations.value = sortConversations(conversations.value, settingsStore.chatListSortMode)
    }

    const upsertConversation = (nextConversation: ChatConversationItem) => {
        conversations.value = upsertConversationItem(conversations.value, nextConversation, settingsStore.chatListSortMode)
    }

    const syncConversationPreview = (conversationId: number, messageItem: Pick<ChatMessageItem, 'content' | 'created_at'>) => {
        conversations.value = syncConversationPreviewInList(conversations.value, conversationId, messageItem, settingsStore.chatListSortMode)
    }

    const syncFriendRemarkLocally = (friendUserId: number, remark: string) => {
        friends.value = friends.value.map((item) => (item.friend_user.id === friendUserId ? { ...item, remark } : item))
        conversations.value = syncFriendRemarkInConversations(conversations.value, friendUserId, remark)
    }

    const resolveActionErrorMessage = (error: unknown, fallback: string) => {
        const maybeError = error as {
            message?: string
            response?: {
                data?: unknown
            }
        }
        const responseData = maybeError?.response?.data
        if (typeof responseData === 'string' && responseData.trim()) {
            return responseData.trim()
        }
        if (responseData && typeof responseData === 'object') {
            const detail = (responseData as { detail?: unknown }).detail
            if (typeof detail === 'string' && detail.trim()) {
                return detail.trim()
            }
            for (const value of Object.values(responseData as Record<string, unknown>)) {
                if (typeof value === 'string' && value.trim()) {
                    return value.trim()
                }
                if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
                    return value[0].trim()
                }
            }
        }
        return String(maybeError?.message || fallback)
    }

    const getLastSequence = (conversationId: number) => {
        const items = messageMap[conversationId] || []
        const lastItem = items.at(-1)
        return lastItem ? Number(lastItem.sequence) : 0
    }

    const removeLocalMessageByClientId = (conversationId: number, clientMessageId: string) => {
        const items = messageMap[conversationId] || []
        messageMap[conversationId] = removeMessageByClientId(items, clientMessageId)
        const failedItems = failedMessageMap.value[conversationId] || []
        failedMessageMap.value = {
            ...failedMessageMap.value,
            [conversationId]: removeMessageByClientId(failedItems, clientMessageId),
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

    const insertLocalAttachmentMessage = (
        conversationId: number,
        options: {
            clientMessageId: string
            displayName: string
            messageType: 'image' | 'file'
            payload: ChatMessageAssetPayload & { client_message_id: string }
            status: 'sending' | 'failed'
            error?: string
        },
    ) => {
        const tempMessage: ChatMessageItem = {
            id: -Date.now(),
            sequence: getLastSequence(conversationId) + 0.01,
            message_type: options.messageType,
            content: options.displayName,
            payload: { ...options.payload },
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
            local_status: options.status,
            local_error: options.error || null,
        }
        const items = messageMap[conversationId] || []
        messageMap[conversationId] = [...items, tempMessage]
        if (options.status === 'failed') {
            upsertFailedMessage(conversationId, tempMessage)
        }
        const conversation = conversations.value.find((item) => item.id === conversationId)
        if (conversation) {
            conversation.last_message_preview = options.displayName
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

    const sendAttachmentMessageByReference = async (options: {
        sourceAssetReferenceId: number
        displayName: string
        mediaType: string
        mimeType?: string
        fileSize?: number
        url?: string
        quotedMessageId?: number
        existingClientMessageId?: string
    }) => {
        await sendAssetMessageAction({
            ...options,
            activeConversation,
            friends,
            currentUserId: userStore.user?.id,
            insertLocalAttachmentMessage,
            updateLocalMessageStatus,
            clearSendingState,
            setSending: (value) => {
                sending.value = value
            },
            scheduleFallback: (conversationId, clientMessageId) => {
                if (sendingFallbackTimer.value) {
                    clearTimeout(sendingFallbackTimer.value)
                }
                sendingFallbackTimer.value = setTimeout(() => {
                    updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '发送超时，请重试')
                    clearSendingState()
                }, 12000)
            },
            scheduleSync: (conversationId, clientMessageId) => {
                if (sendingSyncTimer.value) {
                    clearTimeout(sendingSyncTimer.value)
                }
                sendingSyncTimer.value = setTimeout(() => {
                    void loadMessages(conversationId)
                        .catch(() => undefined)
                        .finally(() => {
                            updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '发送状态未知，请重试')
                            clearSendingState()
                        })
                }, 1500)
            },
        })
    }

    const setConversationUnread = (conversationId: number, unreadCount: number, lastReadSequence?: number) => {
        setConversationUnreadInList(conversations.value, conversationId, unreadCount, lastReadSequence)
    }

    const upsertMessage = (conversationId: number, nextMessage: ChatMessageItem) => {
        const items = messageMap[conversationId] || []
        messageMap[conversationId] = upsertMessageItem(items, nextMessage)
    }

    const removeTypingUser = (conversationId: number, userId: number) => {
        const current = typingMap[conversationId] || []
        typingMap[conversationId] = current.filter((item) => item.id !== userId)
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
        await loadFriendsAction(friends)
    }

    const loadFriendRequests = async () => {
        await loadFriendRequestsAction({
            receivedRequests,
            sentRequests,
            seenFriendNoticeIds,
            seenPendingRequestIds,
        })
    }

    const markPendingRequestsSeen = (requestIds: number[]) => {
        markSeenIdsAction(seenPendingRequestIds, requestIds)
    }

    const markFriendNoticesSeen = (requestIds: number[]) => {
        markSeenIdsAction(seenFriendNoticeIds, requestIds)
    }

    const loadGlobalGroupJoinRequests = async () => {
        const { data } = await getGroupJoinRequestsApi({ status: 'pending' })
        globalGroupJoinRequests.value = data.results
    }

    const loadMessages = async (conversationId: number, params?: { before_sequence?: number; after_sequence?: number; around_sequence?: number; limit?: number }) => {
        await loadMessagesAction({
            conversationId,
            params,
            loadingMessages,
            messageMap,
            failedMessageMap,
            cursorMap,
            upsertConversation,
            loadMembers,
            markConversationRead,
        })
    }

    const selectConversation = async (conversationId: number, options?: { focusSequence?: number }) => {
        activeConversationId.value = conversationId
        const focusSequence = options?.focusSequence
        focusedSequenceMap[conversationId] = focusSequence ?? null
        await loadMessages(conversationId, focusSequence ? { around_sequence: focusSequence, limit: 30 } : undefined)
    }

    const loadOlderMessages = async (conversationId: number) => {
        await loadOlderMessagesAction({ conversationId, cursorMap, loadMessages })
    }

    const markConversationRead = async (conversationId: number, lastReadSequence: number) => {
        await markConversationReadAction({ conversationId, lastReadSequence, setConversationUnread })
    }

    const sendTextMessage = async (content: string, quotedMessageId?: number) => {
        await sendTextMessageAction({
            content,
            quotedMessageId,
            activeConversation,
            friends,
            currentUserId: userStore.user?.id,
            insertLocalMessage,
            updateLocalMessageStatus,
            clearSendingState,
            setSending: (value) => {
                sending.value = value
            },
            scheduleFallback: (conversationId, clientMessageId) => {
                if (sendingFallbackTimer.value) {
                    clearTimeout(sendingFallbackTimer.value)
                }
                sendingFallbackTimer.value = setTimeout(() => {
                    updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '发送超时，请重试')
                    clearSendingState()
                }, 12000)
            },
            scheduleSync: (conversationId, clientMessageId) => {
                if (sendingSyncTimer.value) {
                    clearTimeout(sendingSyncTimer.value)
                }
                sendingSyncTimer.value = setTimeout(() => {
                    void loadMessages(conversationId)
                        .catch(() => undefined)
                        .finally(() => {
                            updateLocalMessageStatus(conversationId, clientMessageId, 'failed', '发送状态未知，请重试')
                            clearSendingState()
                        })
                }, 1500)
            },
        })
    }

    const sendAttachmentMessage = async (options: {
        sourceAssetReferenceId: number
        displayName: string
        mediaType: string
        mimeType?: string
        fileSize?: number
        url?: string
        quotedMessageId?: number
    }) => {
        await sendAttachmentMessageByReference(options)
    }

    const retryMessage = async (messageItem: ChatMessageItem) => {
        if (messageItem.message_type === 'image' || messageItem.message_type === 'file') {
            const attachmentPayload = messageItem.payload as Partial<ChatMessageAssetPayload> & { client_message_id?: string }
            const sourceAssetReferenceId = Number(attachmentPayload.source_asset_reference_id || attachmentPayload.asset_reference_id || 0)
            const clientMessageId = String(attachmentPayload.client_message_id || '')
            if (!sourceAssetReferenceId || !clientMessageId) {
                return
            }
            await sendAttachmentMessageByReference({
                sourceAssetReferenceId,
                displayName: attachmentPayload.display_name || messageItem.content,
                mediaType: attachmentPayload.media_type || messageItem.message_type,
                mimeType: attachmentPayload.mime_type,
                fileSize: attachmentPayload.file_size,
                url: attachmentPayload.url,
                existingClientMessageId: clientMessageId,
            })
            return
        }
        await retryMessageAction({ messageItem, activeConversation, friends, currentUserId: userStore.user?.id, updateLocalMessageStatus })
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
        await openDirectConversationScene({
            targetUserId,
            loadConversations,
            loadContactGroupConversations,
            loadFriends,
            selectConversation,
        })
    }

    const createGroupConversation = async (payload: {
        name: string
        member_user_ids: number[]
        join_approval_required: boolean
        allow_member_invite: boolean
    }) => {
        await createGroupConversationScene({
            payload,
            loadConversations,
            loadContactGroupConversations,
            selectConversation,
        })
    }

    const updateGroupConfig = async (
        conversationId: number,
        payload: { name?: string; avatar?: string; join_approval_required?: boolean; allow_member_invite?: boolean; max_members?: number | null; mute_all?: boolean },
    ) => {
        return updateGroupConfigScene({ conversationId, payload, conversations, upsertConversation })
    }

    const updateConversationPreferences = async (conversationId: number, payload: { mute_notifications?: boolean; group_nickname?: string }) => {
        return updateConversationPreferencesScene({ conversationId, payload, upsertConversation })
    }

    const setFocusedSequence = (conversationId: number, sequence: number | null) => {
        focusedSequenceMap[conversationId] = sequence
    }

    const clearFocusedSequence = (conversationId: number) => {
        focusedSequenceMap[conversationId] = null
    }

    const loadMembers = async (conversationId: number) => {
        await loadMembersAction({ conversationId, conversations, memberMap })
    }

    const inviteMember = async (conversationId: number, targetUserId: number) => {
        await inviteMemberScene({
            conversationId,
            targetUserId,
            loadMembers,
            loadJoinRequests,
            loadConversations,
            loadContactGroupConversations,
        })
    }

    const removeMember = async (conversationId: number, userId: number) => {
        await removeMemberScene({ conversationId, userId, loadMembers, loadConversations, loadContactGroupConversations })
    }

    const updateMemberRole = async (conversationId: number, userId: number, role: 'admin' | 'member') => {
        await updateMemberRoleScene({ conversationId, userId, role, loadMembers })
    }

    const muteMember = async (conversationId: number, userId: number, muteMinutes: number, reason?: string) => {
        await muteMemberScene({ conversationId, userId, muteMinutes, reason, loadMembers })
    }

    const leaveConversation = async (conversationId: number) => {
        await leaveConversationScene({ conversationId, loadConversations, loadContactGroupConversations })
    }

    const loadJoinRequests = async (conversationId: number) => {
        await loadJoinRequestsAction(joinRequestMap, conversationId)
    }

    const handleSocketMessage = createChatRealtimeHandler({
        activeConversationId,
        getCurrentUserId: () => userStore.user?.id,
        typingMap,
        typingTimers,
        appendGroupNotice,
        clearSendingState,
        loadConversations: () => loadConversations(),
        loadFriendRequests,
        loadFriends,
        loadGlobalGroupJoinRequests,
        loadJoinRequests,
        markConversationRead,
        markLatestSendingMessageFailed,
        reconcileLocalMessage,
        removeTypingUser,
        setConversationUnread,
        syncConversationPreview,
        upsertConversation,
        upsertMessage,
    })

    const ensureWsSubscription = () => {
        ensureChatRealtimeSubscription({
            currentUnsubscribe: wsUnsubscribe,
            handler: handleSocketMessage,
            setUnsubscribe: (unsubscribe) => {
                wsUnsubscribe = unsubscribe
            },
        })
    }

    const handleJoinRequest = async (requestId: number, action: 'approve' | 'reject' | 'cancel', conversationId: number) => {
        await handleJoinRequestScene({ requestId, action, conversationId, loadJoinRequests, loadMembers, loadConversations })
    }

    const submitFriendRequest = async (toUserId: number, requestMessage?: string) => {
        await submitFriendRequestScene({ toUserId, requestMessage, loadFriendRequests })
    }

    const handleFriendRequest = async (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
        await handleFriendRequestScene({ requestId, action, loadFriendRequests, loadFriends, loadConversations, loadContactGroupConversations })
    }

    const removeFriend = async (friendUserId: number) => {
        await removeFriendScene({ friendUserId, loadFriends, loadConversations })
    }

    const updateFriendRemark = async (friendUserId: number, remark: string) => {
        await updateFriendRemarkScene({ friendUserId, remark, friends, conversations, syncFriendRemarkLocally })
    }

    const runSearch = async (keyword: string) => {
        await runSearchScene(keyword, searchResult)
    }

    const loadAuditData = async (keyword = '', conversationId?: number) => {
        await loadAuditDataScene({ keyword, conversationId, isAuditAvailable, adminConversations, adminMessages })
    }

    const initialize = async (sortMode: 'recent' | 'unread' = 'recent') => {
        await initializeChatLifecycle({
            clearSendingState,
            ensureWsSubscription,
            loadConversations,
            loadFriends,
            loadFriendRequests,
            loadGlobalGroupJoinRequests,
            loadContactGroupConversations,
            loadMessages: (conversationId) => loadMessages(conversationId),
            activeConversationId,
            initialized,
            sortMode,
        })
    }

    const reset = () => {
        resetChatLifecycle({
            conversations,
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
            activeConversationId,
            messageMap,
            cursorMap,
            memberMap,
            joinRequestMap,
            typingMap,
            focusedSequenceMap,
            typingTimers,
            clearSendingState,
            initialized,
        })
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
        sendAttachmentMessage,
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