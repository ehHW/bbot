import type { Ref } from 'vue'
import { createFriendRequestApi, deleteFriendApi, getFriendRequestsApi, getFriendsApi, handleFriendRequestApi, updateFriendSettingApi } from '@/api/chat'
import type { ChatConversationItem, ChatFriendRequestItem, ChatFriendshipItem } from '@/types/chat'

export async function loadFriendsAction(friends: Ref<ChatFriendshipItem[]>) {
    const { data } = await getFriendsApi()
    friends.value = data.results
}

export async function loadFriendRequestsAction(options: {
    receivedRequests: Ref<ChatFriendRequestItem[]>
    sentRequests: Ref<ChatFriendRequestItem[]>
    seenFriendNoticeIds: Ref<number[]>
    seenPendingRequestIds: Ref<number[]>
}) {
    const { receivedRequests, sentRequests, seenFriendNoticeIds, seenPendingRequestIds } = options
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

export function markSeenIdsAction(target: Ref<number[]>, ids: number[]) {
    if (!ids.length) {
        return
    }
    const seen = new Set(target.value)
    for (const id of ids) {
        seen.add(id)
    }
    target.value = [...seen]
}

export function markStringSeenIdsAction(target: Ref<string[]>, ids: string[]) {
    if (!ids.length) {
        return
    }
    const seen = new Set(target.value)
    for (const id of ids) {
        seen.add(id)
    }
    target.value = [...seen]
}

export async function submitFriendRequestAction(toUserId: number, requestMessage?: string) {
    await createFriendRequestApi({ to_user_id: toUserId, request_message: requestMessage })
}

export async function handleFriendRequestAction(requestId: number, action: 'accept' | 'reject' | 'cancel') {
    await handleFriendRequestApi(requestId, action)
}

export async function removeFriendAction(friendUserId: number) {
    await deleteFriendApi(friendUserId)
}

export async function updateFriendRemarkAction(options: {
    friendUserId: number
    remark: string
    friends: Ref<ChatFriendshipItem[]>
    conversations: Ref<ChatConversationItem[]>
    syncFriendRemarkLocally: (friendUserId: number, remark: string) => void
}) {
    const { data } = await updateFriendSettingApi(options.friendUserId, { remark: options.remark })
    options.syncFriendRemarkLocally(options.friendUserId, data.remark)
}