import type { Ref } from 'vue'
import { handleFriendRequestAction, removeFriendAction, submitFriendRequestAction, updateFriendRemarkAction } from '@/stores/chat/friendshipActions'
import type { ChatConversationItem, ChatFriendshipItem } from '@/types/chat'

export async function submitFriendRequestScene(options: {
    toUserId: number
    requestMessage?: string
    loadFriendRequests: () => Promise<void>
}) {
    await submitFriendRequestAction(options.toUserId, options.requestMessage)
    await options.loadFriendRequests()
}

export async function handleFriendRequestScene(options: {
    requestId: number
    action: 'accept' | 'reject' | 'cancel'
    loadFriendRequests: () => Promise<void>
    loadFriends: () => Promise<void>
    loadConversations: () => Promise<void>
    loadContactGroupConversations: () => Promise<void>
}) {
    await handleFriendRequestAction(options.requestId, options.action)
    await Promise.allSettled([
        options.loadFriendRequests(),
        options.loadFriends(),
        options.loadConversations(),
        options.loadContactGroupConversations(),
    ])
}

export async function removeFriendScene(options: {
    friendUserId: number
    loadFriends: () => Promise<void>
    loadConversations: () => Promise<void>
}) {
    await removeFriendAction(options.friendUserId)
    await Promise.allSettled([options.loadFriends(), options.loadConversations()])
}

export async function updateFriendRemarkScene(options: {
    friendUserId: number
    remark: string
    friends: Ref<ChatFriendshipItem[]>
    conversations: Ref<ChatConversationItem[]>
    syncFriendRemarkLocally: (friendUserId: number, remark: string) => void
}) {
    await updateFriendRemarkAction({
        friendUserId: options.friendUserId,
        remark: options.remark,
        friends: options.friends,
        conversations: options.conversations,
        syncFriendRemarkLocally: options.syncFriendRemarkLocally,
    })
}