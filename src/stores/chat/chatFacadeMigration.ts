import type {
    ChatAssemblyRuntime,
    ChatSearchAuditRuntime,
    ChatStateNamespaces,
} from '@/stores/chat/chatFacade'

// Documentation-only map of the removed flat chat facade surface.
// Keep transitional migration notes here so chatFacade.ts stays focused on the live runtime contract.
export type ChatFacadeLegacyFlatFieldsDoc<TState extends ChatStateNamespaces = ChatStateNamespaces> = {
    /** @deprecated Use state.conversationState.conversations instead. */
    conversations: TState extends { conversationState: { conversations: infer TValue } } ? TValue : never
    /** @deprecated Use state.conversationState.activeConversationId instead. */
    activeConversationId: TState extends { conversationState: { activeConversationId: infer TValue } } ? TValue : never
    /** @deprecated Use state.conversationState.activeConversation instead. */
    activeConversation: TState extends { conversationState: { activeConversation: infer TValue } } ? TValue : never
    /** @deprecated Use state.conversationState.totalUnreadCount instead. */
    totalUnreadCount: TState extends { conversationState: { totalUnreadCount: infer TValue } } ? TValue : never
    /** @deprecated Use state.conversationState.contactGroupConversations instead. */
    contactGroupConversations: TState extends { conversationState: { contactGroupConversations: infer TValue } } ? TValue : never
    /** @deprecated Use state.conversationState.focusedSequenceMap instead. */
    focusedSequenceMap: TState extends { conversationState: { focusedSequenceMap: infer TValue } } ? TValue : never
    /** @deprecated Use state.messageState.activeMessages instead. */
    activeMessages: TState extends { messageState: { activeMessages: infer TValue } } ? TValue : never
    /** @deprecated Use state.messageState.loadingMessages instead. */
    loadingMessages: TState extends { messageState: { loadingMessages: infer TValue } } ? TValue : never
    /** @deprecated Use state.messageState.sending instead. */
    sending: TState extends { messageState: { sending: infer TValue } } ? TValue : never
    /** @deprecated Use state.messageState.typingUsers instead. */
    typingUsers: TState extends { messageState: { typingUsers: infer TValue } } ? TValue : never
    /** @deprecated Use state.messageState.failedMessageMap instead. */
    failedMessageMap: TState extends { messageState: { failedMessageMap: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.friends instead. */
    friends: TState extends { friendshipState: { friends: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.receivedRequests instead. */
    receivedRequests: TState extends { friendshipState: { receivedRequests: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.sentRequests instead. */
    sentRequests: TState extends { friendshipState: { sentRequests: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.seenPendingRequestIds instead. */
    seenPendingRequestIds: TState extends { friendshipState: { seenPendingRequestIds: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.seenFriendNoticeIds instead. */
    seenFriendNoticeIds: TState extends { friendshipState: { seenFriendNoticeIds: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.unreadPendingFriendRequestCount instead. */
    unreadPendingFriendRequestCount: TState extends { friendshipState: { unreadPendingFriendRequestCount: infer TValue } } ? TValue : never
    /** @deprecated Use state.friendshipState.unreadFriendNoticeCount instead. */
    unreadFriendNoticeCount: TState extends { friendshipState: { unreadFriendNoticeCount: infer TValue } } ? TValue : never
    /** @deprecated Use state.groupState.activeMembers instead. */
    activeMembers: TState extends { groupState: { activeMembers: infer TValue } } ? TValue : never
    /** @deprecated Use state.groupState.activeJoinRequests instead. */
    activeJoinRequests: TState extends { groupState: { activeJoinRequests: infer TValue } } ? TValue : never
    /** @deprecated Use state.groupState.globalGroupJoinRequests instead. */
    globalGroupJoinRequests: TState extends { groupState: { globalGroupJoinRequests: infer TValue } } ? TValue : never
    /** @deprecated Use state.groupState.groupNoticeItems instead. */
    groupNoticeItems: TState extends { groupState: { groupNoticeItems: infer TValue } } ? TValue : never
    /** @deprecated Use lifecycle.initialized instead. */
    initialized: ChatAssemblyRuntime['initialized']
    /** @deprecated Use lifecycle.loading instead. */
    loading: ChatAssemblyRuntime['loading']
    /** @deprecated Use lifecycle.initialize instead. */
    initialize: ChatAssemblyRuntime['initialize']
    /** @deprecated Use lifecycle.reset instead. */
    reset: () => void
    /** @deprecated Use audit.searchResult instead. */
    searchResult: ChatSearchAuditRuntime['searchResult']
    /** @deprecated Use audit.adminConversations instead. */
    adminConversations: ChatSearchAuditRuntime['adminConversations']
    /** @deprecated Use audit.adminMessages instead. */
    adminMessages: ChatSearchAuditRuntime['adminMessages']
    /** @deprecated Use audit.isAuditAvailable instead. */
    isAuditAvailable: ChatSearchAuditRuntime['isAuditAvailable']
    /** @deprecated Use audit.runSearch instead. */
    runSearch: ChatSearchAuditRuntime['runSearch']
    /** @deprecated Use audit.clearSearchResult instead. */
    clearSearchResult: ChatSearchAuditRuntime['clearSearchResult']
    /** @deprecated Use audit.loadAuditData instead. */
    loadAuditData: ChatSearchAuditRuntime['loadAuditData']
    /** @deprecated Use conversation.loadConversations instead. */
    loadConversations: ChatAssemblyRuntime['loadConversations']
    /** @deprecated Use conversation.loadContactGroupConversations instead. */
    loadContactGroupConversations: ChatAssemblyRuntime['loadContactGroupConversations']
    /** @deprecated Use friendship.loadFriends instead. */
    loadFriends: ChatAssemblyRuntime['loadFriends']
    /** @deprecated Use friendship.loadFriendRequests instead. */
    loadFriendRequests: ChatAssemblyRuntime['loadFriendRequests']
    /** @deprecated Use friendship.markPendingRequestsSeen instead. */
    markPendingRequestsSeen: ChatAssemblyRuntime['markPendingRequestsSeen']
    /** @deprecated Use friendship.markFriendNoticesSeen instead. */
    markFriendNoticesSeen: ChatAssemblyRuntime['markFriendNoticesSeen']
    /** @deprecated Use message.loadMessages instead. */
    loadMessages: ChatAssemblyRuntime['loadMessages']
    /** @deprecated Use message.loadOlderMessages instead. */
    loadOlderMessages: ChatAssemblyRuntime['loadOlderMessages']
    /** @deprecated Use message.markConversationRead instead. */
    markConversationRead: ChatAssemblyRuntime['markConversationRead']
    /** @deprecated Use conversation.selectConversation instead. */
    selectConversation: ChatAssemblyRuntime['selectConversation']
    /** @deprecated Use conversation.toggleConversationPin instead. */
    toggleConversationPin: ChatAssemblyRuntime['toggleConversationPin']
    /** @deprecated Use conversation.hideConversation instead. */
    hideConversation: ChatAssemblyRuntime['hideConversation']
    /** @deprecated Use conversation.openDirectConversation instead. */
    openDirectConversation: ChatAssemblyRuntime['openDirectConversation']
    /** @deprecated Use conversation.createGroupConversation instead. */
    createGroupConversation: ChatAssemblyRuntime['createGroupConversation']
    /** @deprecated Use conversation.updateGroupConfig instead. */
    updateGroupConfig: ChatAssemblyRuntime['updateGroupConfig']
    /** @deprecated Use conversation.updateConversationPreferences instead. */
    updateConversationPreferences: ChatAssemblyRuntime['updateConversationPreferences']
    /** @deprecated Use conversation.setFocusedSequence instead. */
    setFocusedSequence: ChatAssemblyRuntime['setFocusedSequence']
    /** @deprecated Use conversation.clearFocusedSequence instead. */
    clearFocusedSequence: ChatAssemblyRuntime['clearFocusedSequence']
    /** @deprecated Use message.sendTextMessage instead. */
    sendTextMessage: ChatAssemblyRuntime['sendTextMessage']
    /** @deprecated Use message.sendAttachmentMessage instead. */
    sendAttachmentMessage: ChatAssemblyRuntime['sendAttachmentMessage']
    /** @deprecated Use message.sendTyping instead. */
    sendTyping: ChatAssemblyRuntime['sendTyping']
    /** @deprecated Use message.retryMessage instead. */
    retryMessage: ChatAssemblyRuntime['retryMessage']
    /** @deprecated Use group.loadMembers instead. */
    loadMembers: ChatAssemblyRuntime['loadMembers']
    /** @deprecated Use group.loadJoinRequests instead. */
    loadJoinRequests: ChatAssemblyRuntime['loadJoinRequests']
    /** @deprecated Use group.loadGlobalGroupJoinRequests instead. */
    loadGlobalGroupJoinRequests: ChatAssemblyRuntime['loadGlobalGroupJoinRequests']
    /** @deprecated Use group.inviteMember instead. */
    inviteMember: ChatAssemblyRuntime['inviteMember']
    /** @deprecated Use group.removeMember instead. */
    removeMember: ChatAssemblyRuntime['removeMember']
    /** @deprecated Use group.updateMemberRole instead. */
    updateMemberRole: ChatAssemblyRuntime['updateMemberRole']
    /** @deprecated Use group.muteMember instead. */
    muteMember: ChatAssemblyRuntime['muteMember']
    /** @deprecated Use group.leaveConversation instead. */
    leaveConversation: ChatAssemblyRuntime['leaveConversation']
    /** @deprecated Use group.handleJoinRequest instead. */
    handleJoinRequest: ChatAssemblyRuntime['handleJoinRequest']
    /** @deprecated Use friendship.submitFriendRequest instead. */
    submitFriendRequest: ChatAssemblyRuntime['submitFriendRequest']
    /** @deprecated Use friendship.handleFriendRequest instead. */
    handleFriendRequest: ChatAssemblyRuntime['handleFriendRequest']
    /** @deprecated Use friendship.removeFriend instead. */
    removeFriend: ChatAssemblyRuntime['removeFriend']
    /** @deprecated Use friendship.updateFriendRemark instead. */
    updateFriendRemark: ChatAssemblyRuntime['updateFriendRemark']
}