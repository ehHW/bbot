import type { Ref } from 'vue'
import { loadFriendRequestsAction, loadFriendsAction, markSeenIdsAction, markStringSeenIdsAction } from '@/stores/chat/friendshipActions'
import { handleFriendRequestScene, removeFriendScene, submitFriendRequestScene, updateFriendRemarkScene } from '@/stores/chat/friendshipScenes'
import type { ChatConversationItem, ChatFriendNoticeItem, ChatFriendRequestItem, ChatFriendshipItem } from '@/types/chat'

export function createFriendshipOrchestration(deps: {
    friends: Ref<ChatFriendshipItem[]>
    receivedRequests: Ref<ChatFriendRequestItem[]>
    sentRequests: Ref<ChatFriendRequestItem[]>
    friendNoticeItems: Ref<ChatFriendNoticeItem[]>
    seenFriendNoticeIds: Ref<number[]>
    seenFriendSystemNoticeIds: Ref<string[]>
    seenPendingRequestIds: Ref<number[]>
    conversations: Ref<ChatConversationItem[]>
    syncFriendRemarkLocally: (friendUserId: number, remark: string) => void
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    const loadFriends = async () => {
        await loadFriendsAction(deps.friends)
    }

    const loadFriendRequests = async () => {
        await loadFriendRequestsAction({
            receivedRequests: deps.receivedRequests,
            sentRequests: deps.sentRequests,
            seenFriendNoticeIds: deps.seenFriendNoticeIds,
            seenPendingRequestIds: deps.seenPendingRequestIds,
        })
    }

    const markPendingRequestsSeen = (requestIds: number[]) => {
        markSeenIdsAction(deps.seenPendingRequestIds, requestIds)
    }

    const markFriendNoticesSeen = (requestIds: number[]) => {
        markSeenIdsAction(deps.seenFriendNoticeIds, requestIds)
    }

    const appendFriendNotice = (notice: ChatFriendNoticeItem) => {
        deps.friendNoticeItems.value = [notice, ...deps.friendNoticeItems.value.filter((item) => item.id !== notice.id)].slice(0, 100)
    }

    const markFriendSystemNoticesSeen = (noticeIds: string[]) => {
        markStringSeenIdsAction(deps.seenFriendSystemNoticeIds, noticeIds)
    }

    const submitFriendRequest = async (toUserId: number, requestMessage?: string) => {
        await submitFriendRequestScene({ toUserId, requestMessage, loadFriendRequests })
    }

    const handleFriendRequest = async (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
        await handleFriendRequestScene({ requestId, action, loadFriendRequests, loadFriends, loadConversations: deps.loadConversations, loadContactGroupConversations: deps.loadContactGroupConversations })
    }

    const removeFriend = async (friendUserId: number) => {
        await removeFriendScene({ friendUserId, loadFriends, loadConversations: deps.loadConversations })
    }

    const updateFriendRemark = async (friendUserId: number, remark: string) => {
        await updateFriendRemarkScene({ friendUserId, remark, friends: deps.friends, conversations: deps.conversations, syncFriendRemarkLocally: deps.syncFriendRemarkLocally })
    }

    return {
        loadFriends,
        loadFriendRequests,
        markPendingRequestsSeen,
        markFriendNoticesSeen,
        appendFriendNotice,
        markFriendSystemNoticesSeen,
        submitFriendRequest,
        handleFriendRequest,
        removeFriend,
        updateFriendRemark,
    }
}