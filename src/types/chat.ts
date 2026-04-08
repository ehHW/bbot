import type { ListResult } from '@/types/user'

export type ChatConversationType = 'direct' | 'group'
export type ChatAccessMode = 'member' | 'stealth_readonly'
export type ChatMessageType = 'text' | 'system' | 'image' | 'file'
export type ChatMemberRole = 'owner' | 'admin' | 'member'
export type ChatRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired'
export type ChatJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled'
export type ChatLocalMessageStatus = 'sending' | 'failed'

export interface ChatUserBrief {
    id: number
    username: string
    display_name: string
    avatar: string
}

export interface ChatGroupConfig {
    join_approval_required: boolean
    allow_member_invite: boolean
    max_members: number | null
    mute_all: boolean
}

export interface ChatConversationMemberSettings {
    mute_notifications: boolean
    group_nickname: string
}

export interface ChatConversationItem {
    id: number
    type: ChatConversationType
    name: string
    avatar: string
    direct_target: ChatUserBrief | null
    friend_remark: string | null
    is_pinned: boolean
    access_mode: ChatAccessMode
    member_role: ChatMemberRole | null
    show_in_list: boolean
    unread_count: number
    last_message_preview: string
    last_message_at: string | null
    member_count: number
    can_send_message: boolean
    status: string
    last_read_sequence: number
    member_settings: ChatConversationMemberSettings
    group_config: ChatGroupConfig | null
    owner: ChatUserBrief | null
}

export interface ChatMessageItem {
    id: number
    sequence: number
    client_message_id?: string | null
    message_type: ChatMessageType
    content: string
    payload: Record<string, unknown>
    is_system: boolean
    sender: ChatUserBrief | null
    created_at: string
    local_status?: ChatLocalMessageStatus | null
    local_error?: string | null
}

export interface ChatMessageCursor {
    before_sequence: number | null
    after_sequence: number | null
    has_more_before: boolean
    has_more_after: boolean
}

export interface ChatMessageListResult {
    conversation: {
        id: number
        type: ChatConversationType
        access_mode: ChatAccessMode
        can_send_message: boolean
    }
    cursor: ChatMessageCursor
    items: ChatMessageItem[]
}

export interface ChatFriendRequestItem {
    id: number
    status: ChatRequestStatus
    from_user: ChatUserBrief
    to_user: ChatUserBrief
    request_message: string
    auto_accepted: boolean
    handled_by: ChatUserBrief | null
    handled_at: string | null
    created_at: string
}

export interface ChatFriendshipItem {
    friendship_id: number
    friend_user: ChatUserBrief
    accepted_at: string
    remark: string
    direct_conversation: {
        id: number
        show_in_list: boolean
    } | null
}

export interface ChatConversationMemberItem {
    user: ChatUserBrief
    role: ChatMemberRole
    status: string
    mute_until: string | null
    joined_at: string
    group_nickname: string
    friend_remark: string | null
}

export interface ChatGroupJoinRequestItem {
    id: number
    conversation_id: number
    status: ChatJoinRequestStatus
    target_user: ChatUserBrief
    created_at: string
}

export interface ChatGroupNoticeItem {
    id: string
    conversation_id: number | null
    message: string
    created_at: string
    payload: Record<string, unknown>
}

export interface ChatSearchConversationItem {
    id: number
    type: ChatConversationType
    name: string
    access_mode: ChatAccessMode
}

export interface ChatSearchUserItem {
    id: number
    username: string
    display_name: string
    avatar: string
    can_open_direct: boolean
    direct_conversation: {
        id: number
        show_in_list: boolean
    } | null
}

export interface ChatSearchMessageItem {
    conversation_id: number
    conversation_name: string
    message_id: number
    sequence: number
    message_type: ChatMessageType
    content_preview: string
    sender: ChatUserBrief | null
    created_at: string
}

export interface ChatSearchResult {
    keyword: string
    conversations: ChatSearchConversationItem[]
    users: ChatSearchUserItem[]
    messages: ChatSearchMessageItem[]
}

export interface ChatPreferencePayload {
    theme_mode: 'light' | 'dark'
    chat_receive_notification: boolean
    chat_list_sort_mode: 'recent' | 'unread'
    chat_stealth_inspect_enabled: boolean
    settings_json: Record<string, unknown>
}

export interface ChatAdminConversationResult extends ListResult<ChatConversationItem> { }
export interface ChatAdminMessageResult extends ListResult<ChatMessageItem & { conversation_id: number }> { }
