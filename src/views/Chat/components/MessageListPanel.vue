<template>
    <section class="chat-panel">
        <div class="toolbar-row">
            <div class="search-box" @mousedown.prevent>
                <a-input v-model:value="searchKeyword" allow-clear placeholder="搜索好友、群聊、聊天记录" @focus="searchFocused = true" @blur="handleSearchBlur" />

                <div v-if="searchDropdownVisible" class="search-dropdown">
                    <div class="search-dropdown__section" v-if="topUserMatches.length">
                        <div class="search-dropdown__label">用户</div>
                        <button v-for="item in topUserMatches" :key="item.key" type="button" class="search-dropdown__item" @click="handleTopMatchClick(item)">
                            <span class="search-dropdown__primary">{{ item.label }}</span>
                            <small class="search-dropdown__secondary">{{ item.meta }}</small>
                        </button>
                    </div>

                    <div class="search-dropdown__section" v-if="recentMessageMatches.length">
                        <div class="search-dropdown__label">聊天记录</div>
                        <button v-for="item in recentMessageMatches" :key="item.message_id" type="button" class="search-dropdown__item" @click="openConversation(item.conversation_id, item.sequence)">
                            <span class="search-dropdown__primary">{{ item.conversation_name }}</span>
                            <small class="search-dropdown__secondary">{{ item.content_preview }}</small>
                        </button>
                    </div>

                    <button type="button" class="search-dropdown__more" @click="allResultModalOpen = true">查看全部匹配结果</button>
                </div>
            </div>

            <a-dropdown :trigger="['hover']" placement="bottomRight">
                <a-button type="primary" class="chat-action-trigger">+</a-button>
                <template #overlay>
                    <a-menu @click="handleQuickMenuClick">
                        <a-menu-item key="group">创建群聊</a-menu-item>
                        <a-menu-item key="discover">加好友/群</a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </div>

        <div class="chat-panel__list">
            <button
                v-for="conversation in chatStore.conversations"
                :key="conversation.id"
                class="conversation-item"
                :class="{ active: chatStore.activeConversationId === conversation.id, pinned: conversation.is_pinned }"
                type="button"
                @click="openConversation(conversation.id)"
                @contextmenu.prevent="openConversationMenu($event, conversation)"
            >
                <a-avatar :src="conversation.avatar || undefined" :style="avatarStyle(conversation.type)">
                    {{ avatarText(conversationDisplayName(conversation)) }}
                </a-avatar>
                <div class="conversation-item__body">
                    <div class="conversation-item__top">
                        <span class="conversation-item__name">{{ conversationDisplayName(conversation) }}</span>
                        <span class="conversation-item__time">{{ formatShortTime(conversation.last_message_at) }}</span>
                    </div>
                    <div class="conversation-item__bottom">
                        <span class="conversation-item__preview">{{ conversation.last_message_preview || '暂无消息' }}</span>
                        <a-badge v-if="conversation.unread_count > 0" :count="conversation.unread_count" :overflow-count="99" :number-style="badgeStyle" />
                    </div>
                </div>
            </button>
            <a-empty v-if="!chatStore.conversations.length" description="暂无会话" />
        </div>

        <transition name="context-menu-fade">
            <div v-if="contextMenuOpen" class="context-menu" :style="contextMenuStyle">
                <button type="button" class="context-menu__item" @click="handleHideConversation">删除</button>
                <button type="button" class="context-menu__item" @click="handleTogglePin">{{ contextConversation?.is_pinned ? '取消置顶' : '置顶' }}</button>
            </div>
        </transition>

        <a-modal v-model:open="allResultModalOpen" title="搜索结果" :footer="null" :width="CHAT_MODAL_WIDTH_MD" :body-style="tallModalBodyStyle">
            <a-tabs v-model:activeKey="activeResultTab">
                <a-tab-pane key="conversations" tab="会话">
                    <div class="drawer-list">
                        <div v-for="conversation in chatStore.searchResult?.conversations || []" :key="`result-conversation-${conversation.id}`" class="drawer-list-item">
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">{{ conversation.name }}</div>
                                <div class="drawer-list-desc">{{ conversation.type === 'group' ? '群聊' : '私聊' }}</div>
                            </div>
                            <a-button size="small" @click="openConversation(conversation.id)">打开</a-button>
                        </div>
                        <a-empty v-if="!(chatStore.searchResult?.conversations || []).length" description="暂无匹配会话" />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="users" tab="用户">
                    <div class="drawer-list">
                        <div v-for="user in chatStore.searchResult?.users || []" :key="`result-user-${user.id}`" class="drawer-list-item">
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">{{ user.display_name || user.username }}</div>
                                <div class="drawer-list-desc">{{ user.username }}</div>
                            </div>
                            <a-space>
                                <a-button size="small" @click="openDirectConversation(user.id)" :disabled="!user.can_open_direct">私聊</a-button>
                                <a-button size="small" type="primary" @click="handleSendFriendRequest(user.id)">加好友</a-button>
                            </a-space>
                        </div>
                        <a-empty v-if="!(chatStore.searchResult?.users || []).length" description="暂无匹配用户" />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="groups" tab="群聊">
                    <div class="drawer-list">
                        <div v-for="conversation in matchedGroups" :key="`result-group-${conversation.id}`" class="drawer-list-item">
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">{{ conversation.name }}</div>
                                <div class="drawer-list-desc">群聊</div>
                            </div>
                            <a-button size="small" @click="openConversation(conversation.id)">打开</a-button>
                        </div>
                        <a-empty v-if="!matchedGroups.length" description="暂无匹配群聊" />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="messages" tab="聊天记录">
                    <div class="drawer-list">
                        <button
                            v-for="messageItem in chatStore.searchResult?.messages || []"
                            :key="`result-message-${messageItem.message_id}`"
                            type="button"
                            class="drawer-list-item search-message-card"
                            @click="openConversation(messageItem.conversation_id, messageItem.sequence)"
                        >
                            <div class="search-message-card__top">
                                <div class="drawer-list-title">{{ messageItem.conversation_name }}</div>
                                <div class="drawer-list-time">{{ formatShortTime(messageItem.created_at) }}</div>
                            </div>
                            <div class="drawer-list-desc">{{ messageItem.content_preview }}</div>
                        </button>
                        <a-empty v-if="!(chatStore.searchResult?.messages || []).length" description="暂无匹配聊天记录" />
                    </div>
                </a-tab-pane>
            </a-tabs>
        </a-modal>

        <a-modal v-model:open="discoverModalOpen" title="加好友/群" :footer="null" :width="CHAT_MODAL_WIDTH_MD" :body-style="tallModalBodyStyle">
            <a-input v-model:value="discoverKeyword" allow-clear placeholder="搜索用户名、昵称或群聊名称" />
            <a-tabs v-model:activeKey="discoverTab" class="discover-tabs">
                <a-tab-pane key="users" tab="匹配的用户">
                    <div class="drawer-list">
                        <div v-for="user in discoverUsers" :key="`discover-user-${user.id}`" class="drawer-list-item">
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">{{ user.display_name || user.username }}</div>
                                <div class="drawer-list-desc">{{ user.username }}</div>
                            </div>
                            <a-space>
                                <a-button size="small" @click="openDirectConversation(user.id)" :disabled="!user.can_open_direct">私聊</a-button>
                                <a-button size="small" type="primary" @click="handleSendFriendRequest(user.id)">加好友</a-button>
                            </a-space>
                        </div>
                        <a-empty v-if="!discoverUsers.length && discoverKeyword.trim()" description="暂无匹配用户" />
                    </div>
                </a-tab-pane>
                <a-tab-pane key="groups" tab="匹配的群聊">
                    <div class="drawer-list">
                        <div v-for="conversation in discoverGroups" :key="`discover-group-${conversation.id}`" class="drawer-list-item">
                            <div class="drawer-list-item__content">
                                <div class="drawer-list-title">{{ conversation.name }}</div>
                                <div class="drawer-list-desc">群聊</div>
                            </div>
                            <a-button size="small" @click="openConversation(conversation.id)">打开</a-button>
                        </div>
                        <a-empty v-if="!discoverGroups.length && discoverKeyword.trim()" description="暂无匹配群聊" />
                    </div>
                </a-tab-pane>
            </a-tabs>
        </a-modal>

        <a-modal v-model:open="groupModalOpen" title="创建群聊" @ok="handleCreateGroup" :confirm-loading="groupSaving" :width="CHAT_MODAL_WIDTH_SM" :body-style="tallModalBodyStyle">
            <a-form layout="vertical" :model="groupForm">
                <a-form-item label="群名称">
                    <a-input v-model:value="groupForm.name" :maxlength="50" />
                </a-form-item>
                <a-form-item label="初始成员">
                    <a-select v-model:value="groupForm.member_user_ids" mode="multiple" :options="friendOptions" placeholder="选择好友加入群聊" />
                </a-form-item>
                <a-form-item label="入群需审批">
                    <a-switch v-model:checked="groupForm.join_approval_required" />
                </a-form-item>
                <a-form-item label="允许普通成员邀请">
                    <a-switch v-model:checked="groupForm.allow_member_invite" />
                </a-form-item>
            </a-form>
        </a-modal>
    </section>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchChatApi } from '@/api/chat'
import type { ChatConversationItem, ChatSearchResult } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

type TopMatchItem = {
    key: string
    label: string
    meta: string
    kind: 'conversation' | 'user'
    id: number
}

const route = useRoute()
const router = useRouter()
const { avatarStyle, avatarText, chatStore, formatShortTime } = useChatShell()

const searchKeyword = ref('')
const friendRequestMessage = ref('')
const groupModalOpen = ref(false)
const groupSaving = ref(false)
const allResultModalOpen = ref(false)
const activeResultTab = ref('conversations')
const searchFocused = ref(false)
const searchTimer = ref<number | null>(null)
const contextMenuOpen = ref(false)
const contextConversation = ref<ChatConversationItem | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })
const discoverModalOpen = ref(false)
const discoverKeyword = ref('')
const CHAT_MODAL_WIDTH_SM = 427
const CHAT_MODAL_WIDTH_MD = 480
const discoverTab = ref('users')
const discoverTimer = ref<number | null>(null)
const discoverResult = ref<ChatSearchResult | null>(null)
const tallModalBodyStyle = {
    minHeight: '54vh',
    maxHeight: '72vh',
    overflowY: 'auto' as const,
}

const badgeStyle = {
    backgroundColor: '#ef4444',
    boxShadow: 'none',
}

const groupForm = reactive({
    name: '',
    member_user_ids: [] as number[],
    join_approval_required: true,
    allow_member_invite: true,
})

const friendOptions = computed(() =>
    chatStore.friends.map((item) => ({
        label: `${item.friend_user.display_name || item.friend_user.username} (${item.friend_user.username})`,
        value: item.friend_user.id,
    })),
)

const friendIds = computed(() => new Set(chatStore.friends.map((item) => item.friend_user.id)))
const topUserMatches = computed<TopMatchItem[]>(() => {
    return (chatStore.searchResult?.users || []).map((item) => ({
        key: `user-${item.id}`,
        label: item.display_name || item.username,
        meta: friendIds.value.has(item.id) ? '好友' : '用户',
        kind: 'user' as const,
        id: item.id,
    })).slice(0, 3)
})
const recentMessageMatches = computed(() => (chatStore.searchResult?.messages || []).slice(0, 3))
const matchedGroups = computed(() => (chatStore.searchResult?.conversations || []).filter((item) => item.type === 'group'))
const searchDropdownVisible = computed(() => searchFocused.value && Boolean(searchKeyword.value.trim()) && (topUserMatches.value.length > 0 || recentMessageMatches.value.length > 0))
const contextMenuStyle = computed(() => ({ left: `${contextMenuPosition.value.x}px`, top: `${contextMenuPosition.value.y}px` }))
const discoverUsers = computed(() => discoverResult.value?.users || [])
const discoverGroups = computed(() => (discoverResult.value?.conversations || []).filter((item) => item.type === 'group'))

const conversationDisplayName = (conversation: ChatConversationItem) => conversation.friend_remark || conversation.name

const closeContextMenu = () => {
    contextMenuOpen.value = false
    contextConversation.value = null
}

const handleDocumentClick = () => {
    closeContextMenu()
}

const triggerSearch = async (keyword: string) => {
    if (!keyword.trim()) {
        chatStore.searchResult = null
        return
    }
    try {
        await chatStore.runSearch(keyword.trim())
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '搜索失败'))
    }
}

const triggerDiscoverSearch = async (keyword: string) => {
    if (!keyword.trim()) {
        discoverResult.value = null
        return
    }
    try {
        const { data } = await searchChatApi({ keyword: keyword.trim(), limit: 20 })
        discoverResult.value = data
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '搜索失败'))
    }
}

const openConversation = async (conversationId: number, focusSequence?: number) => {
    searchFocused.value = false
    discoverModalOpen.value = false
    await chatStore.selectConversation(conversationId, focusSequence ? { focusSequence } : undefined)
    if (route.name !== 'ChatMessages') {
        await router.push({ name: 'ChatMessages' })
    }
    allResultModalOpen.value = false
    closeContextMenu()
}

const openDirectConversation = async (userId: number) => {
    try {
        const directConversationId = chatStore.searchResult?.users.find((item) => item.id === userId)?.direct_conversation?.id
            || chatStore.friends.find((item) => item.friend_user.id === userId)?.direct_conversation?.id
        if (directConversationId) {
            await chatStore.selectConversation(directConversationId)
        } else {
            await chatStore.openDirectConversation(userId)
        }
        await router.push({ name: 'ChatMessages' })
        allResultModalOpen.value = false
        discoverModalOpen.value = false
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '打开私聊失败'))
    }
}

const openDiscoverModal = () => {
    discoverModalOpen.value = true
    discoverTab.value = 'users'
}

const handleQuickMenuClick = ({ key }: { key: string }) => {
    if (key === 'group') {
        void openGroupModal()
        return
    }
    if (key === 'discover') {
        openDiscoverModal()
    }
}

const handleTopMatchClick = async (item: TopMatchItem) => {
    if (item.kind === 'conversation') {
        await openConversation(item.id)
        return
    }
    await openDirectConversation(item.id)
}

const handleSendFriendRequest = async (userId: number) => {
    try {
        await chatStore.submitFriendRequest(userId, friendRequestMessage.value.trim() || undefined)
        message.success('好友申请已发送')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '发送好友申请失败'))
    }
}

const handleSearchBlur = () => {
    window.setTimeout(() => {
        searchFocused.value = false
    }, 120)
}

const openGroupModal = async () => {
    groupModalOpen.value = true
    try {
        await chatStore.loadFriends()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载好友数据失败'))
    }
}

const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
        message.warning('请输入群名称')
        return
    }
    groupSaving.value = true
    try {
        await chatStore.createGroupConversation({
            name: groupForm.name.trim(),
            member_user_ids: groupForm.member_user_ids,
            join_approval_required: groupForm.join_approval_required,
            allow_member_invite: groupForm.allow_member_invite,
        })
        groupModalOpen.value = false
        groupForm.name = ''
        groupForm.member_user_ids = []
        message.success('群聊创建成功')
        await router.push({ name: 'ChatMessages' })
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '创建群聊失败'))
    } finally {
        groupSaving.value = false
    }
}

const openConversationMenu = (event: MouseEvent, conversation: ChatConversationItem) => {
    contextConversation.value = conversation
    contextMenuPosition.value = { x: event.clientX, y: event.clientY }
    contextMenuOpen.value = true
}

const handleHideConversation = async () => {
    if (!contextConversation.value) {
        return
    }
    try {
        await chatStore.hideConversation(contextConversation.value.id)
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '删除会话失败'))
    } finally {
        closeContextMenu()
    }
}

const handleTogglePin = async () => {
    if (!contextConversation.value) {
        return
    }
    try {
        await chatStore.toggleConversationPin(contextConversation.value.id, !contextConversation.value.is_pinned)
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '更新置顶状态失败'))
    } finally {
        closeContextMenu()
    }
}

watch(
    () => searchKeyword.value,
    (keyword) => {
        if (searchTimer.value) {
            window.clearTimeout(searchTimer.value)
            searchTimer.value = null
        }
        searchTimer.value = window.setTimeout(() => {
            void triggerSearch(keyword)
        }, 220)
    },
)

watch(
    () => discoverKeyword.value,
    (keyword) => {
        if (discoverTimer.value) {
            window.clearTimeout(discoverTimer.value)
            discoverTimer.value = null
        }
        discoverTimer.value = window.setTimeout(() => {
            void triggerDiscoverSearch(keyword)
        }, 220)
    },
)

onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('scroll', handleDocumentClick, true)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('scroll', handleDocumentClick, true)
    if (searchTimer.value) {
        window.clearTimeout(searchTimer.value)
    }
    if (discoverTimer.value) {
        window.clearTimeout(discoverTimer.value)
    }
})
</script>

<style scoped>
.chat-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    height: 100%;
    padding: 14px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 0;
    box-shadow: none;
}

.toolbar-row,
.drawer-list-item,
.conversation-item__top,
.conversation-item__bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.search-box {
    position: relative;
    flex: 1;
}

.chat-action-trigger {
    width: 28px;
    min-width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 10px;
    font-size: 16px;
    line-height: 1;
}

.context-menu {
    position: absolute;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 136px;
    padding: 6px;
    background: var(--chat-panel-bg-strong);
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    box-shadow: var(--chat-panel-shadow);
}

.context-menu {
    position: fixed;
}

.context-menu__item {
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--chat-text-primary);
    text-align: left;
    cursor: pointer;
}

.context-menu__item:hover {
    background: var(--chat-accent-soft);
}

:deep(.ant-dropdown-menu) {
    padding: 6px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
    box-shadow: var(--chat-panel-shadow);
}

:deep(.ant-dropdown-menu-item) {
    border-radius: 8px;
    color: var(--chat-text-primary);
}

:deep(.ant-dropdown-menu-item:hover),
:deep(.ant-dropdown-menu-item-active),
:deep(.ant-dropdown-menu-item-selected) {
    background: var(--chat-accent-soft);
}

.context-menu-fade-enter-active,
.context-menu-fade-leave-active {
    transition: opacity 0.16s ease, transform 0.16s ease;
}

.context-menu-fade-enter-from,
.context-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
}

.search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 20;
    padding: 8px;
    background: var(--chat-panel-bg-strong);
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    box-shadow: var(--chat-panel-shadow);
}

.search-dropdown__section,
.chat-panel__list,
.drawer-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.search-dropdown__label {
    padding: 2px 6px 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--chat-text-secondary);
}

.chat-panel__list,
.drawer-list {
    min-height: 0;
    overflow: auto;
}

.search-dropdown__item,
.search-dropdown__more {
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--chat-text-primary);
    text-align: left;
    cursor: pointer;
}

.search-dropdown__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.search-dropdown__primary,
.search-dropdown__secondary {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.search-dropdown__item small,
.drawer-list-desc,
.conversation-item__preview,
.conversation-item__time {
    color: var(--chat-text-secondary);
}

.search-dropdown__item:hover,
.search-dropdown__more:hover {
    background: var(--chat-accent-soft);
}

.search-dropdown__more {
    color: var(--chat-accent);
}

.conversation-item {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
    text-align: left;
    cursor: pointer;
    transition: 0.2s ease;
}

.conversation-item:hover,
.conversation-item.active {
    border-color: color-mix(in srgb, var(--chat-accent) 32%, transparent);
    box-shadow: 0 8px 18px color-mix(in srgb, var(--chat-accent) 16%, transparent);
}

.conversation-item.pinned {
    background: linear-gradient(180deg, color-mix(in srgb, var(--chat-accent-soft) 70%, transparent), var(--chat-panel-bg-strong));
}

.conversation-item__body {
    min-width: 0;
}

.conversation-item__name,
.drawer-list-title {
    font-weight: 700;
    color: var(--chat-text-primary);
}

.conversation-item__preview {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.drawer-list-item__content {
    flex: 1;
    min-width: 0;
}

.drawer-list-title,
.drawer-list-desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.search-message-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.search-message-card:hover {
    border-color: color-mix(in srgb, var(--chat-accent) 30%, transparent);
    background: var(--chat-accent-soft);
    transform: translateY(-1px);
}

.search-message-card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.drawer-list-time {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.discover-tabs {
    margin-top: 12px;
}

@media (max-width: 960px) {
    .chat-panel {
        min-height: 320px;
    }
}
</style>
