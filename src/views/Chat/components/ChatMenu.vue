<template>
    <aside class="chat-menu">
        <button
            v-for="item in items"
            :key="item.name"
            type="button"
            class="chat-menu__item"
            :class="{ active: isActive(item.name) }"
            @click="router.push({ name: item.name })"
        >
            <a-badge :count="item.count" :number-style="badgeStyle" :overflow-count="99">
                <component :is="item.icon" />
            </a-badge>
            <span>{{ item.label }}</span>
        </button>
    </aside>
</template>

<script setup lang="ts">
import { MessageOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatShell } from '@/views/Chat/useChatShell'

const router = useRouter()
const route = useRoute()
const { chatStore } = useChatShell()
const chatConversationState = chatStore.state.conversationState
const chatFriendshipState = chatStore.state.friendshipState
const chatGroupState = chatStore.state.groupState

const pendingFriendRequestCount = computed(
    () => chatFriendshipState.unreadPendingFriendRequestCount,
)

const contactNoticeCount = computed(
    () => pendingFriendRequestCount.value + chatGroupState.globalGroupJoinRequests.length + chatGroupState.groupNoticeItems.length + chatFriendshipState.unreadFriendNoticeCount,
)

const badgeStyle = {
    backgroundColor: '#ef4444',
    boxShadow: 'none',
}

const items = computed(() => {
    return [
        { name: 'ChatMessages', label: '消息', icon: MessageOutlined, count: chatConversationState.totalUnreadCount },
        { name: 'ChatContactsFriendNotices', label: '联系人', icon: TeamOutlined, count: contactNoticeCount.value },
        { name: 'ChatSettingsShortcuts', label: '设置', icon: SettingOutlined, count: 0 },
    ]
})

const isActive = (name: string) => {
    if (name === 'ChatContactsFriendNotices') {
        return String(route.name || '').startsWith('ChatContacts')
    }
    if (name === 'ChatSettingsShortcuts') {
        return String(route.name || '').startsWith('ChatSettings')
    }
    return route.name === name
}
</script>

<style scoped>
.chat-menu {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 6px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px 0 0 14px;
    color: var(--chat-text-secondary);
    box-shadow: var(--chat-panel-shadow);
}

.chat-menu__item {
    width: 100%;
    border: 0;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 2px;
    border-radius: 12px;
    color: inherit;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease;
}

.chat-menu__item:hover,
.chat-menu__item.active {
    color: var(--chat-accent);
    background: var(--chat-accent-soft);
    transform: translateY(-1px);
}

.chat-menu__item :deep(svg) {
    font-size: 18px;
}

.chat-menu__item span {
    font-size: 10px;
}

@media (max-width: 960px) {
    .chat-menu {
        flex-direction: row;
        justify-content: space-between;
        border-radius: 14px;
    }

    .chat-menu__item {
        width: auto;
        min-width: 76px;
    }
}
</style>
