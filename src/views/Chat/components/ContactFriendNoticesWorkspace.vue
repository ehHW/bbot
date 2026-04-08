<template>
    <section class="chat-workspace">
        <div class="notice-list">
            <div v-for="item in friendNoticeItems" :key="`${item.kind}-${item.id}`" class="notice-item">
                <div class="notice-item__title">{{ item.title }}</div>
                <div class="notice-item__desc">{{ item.description }}</div>
                <div class="notice-item__time">{{ formatDateTime(item.created_at) }}</div>
            </div>
            <a-empty v-if="!friendNoticeItems.length" description="暂无好友通知" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useChatShell } from '@/views/Chat/useChatShell'

const { chatStore, formatDateTime } = useChatShell()

const friendNoticeItems = computed(() => {
    const received = chatStore.receivedRequests
        .filter((item) => item.status !== 'pending')
        .map((item) => ({
            id: item.id,
            kind: 'received',
            title: `${item.from_user.display_name || item.from_user.username} 的好友申请${item.status === 'accepted' ? '已通过' : item.status === 'rejected' ? '已拒绝' : '已处理'}`,
            description: item.request_message || '无附言',
            created_at: item.handled_at || item.created_at,
        }))
    const sent = chatStore.sentRequests
        .filter((item) => item.status !== 'pending')
        .map((item) => ({
            id: item.id,
            kind: 'sent',
            title: `你发给 ${item.to_user.display_name || item.to_user.username} 的好友申请${item.status === 'accepted' ? '已通过' : item.status === 'rejected' ? '已拒绝' : item.status === 'canceled' ? '已撤销' : '已处理'}`,
            description: item.request_message || '无附言',
            created_at: item.handled_at || item.created_at,
        }))
    return [...received, ...sent].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
})

watch(
    friendNoticeItems,
    (items) => {
        chatStore.markFriendNoticesSeen(items.map((item) => item.id))
    },
    { immediate: true },
)
</script>

<style scoped>
.chat-workspace {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    padding: 18px 22px;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    overflow: auto;
    box-shadow: var(--chat-panel-shadow);
}

.notice-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notice-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.notice-item__title {
    font-weight: 700;
    color: var(--chat-text-primary);
}

.notice-item__desc,
.notice-item__time {
    color: var(--chat-text-secondary);
}

.notice-item__time {
    margin-top: 4px;
    font-size: 12px;
}
</style>