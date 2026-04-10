<template>
    <section class="chat-workspace">
        <header class="chat-workspace__header">
            <div>
                <div class="chat-workspace__title">好友通知</div>
                <div class="chat-workspace__subtitle">这里统一查看好友申请、处理结果和自己的申请记录</div>
            </div>
        </header>

        <a-divider orientation="left">待处理的好友申请</a-divider>
        <div class="notice-list">
            <div v-for="request in chatFriendshipState.receivedRequests" :key="`pending-${request.id}`" class="notice-item notice-item--request">
                <div>
                    <div class="notice-item__title">{{ request.from_user.display_name || request.from_user.username }}</div>
                    <div class="notice-item__desc">{{ request.request_message || '对方没有填写附言' }}</div>
                    <div class="notice-item__time">{{ formatDateTime(request.created_at) }}</div>
                </div>
                <a-space v-if="request.status === 'pending'">
                    <a-button size="small" type="primary" @click="handleRequestAction(request.id, 'accept')">通过</a-button>
                    <a-button size="small" @click="handleRequestAction(request.id, 'reject')">拒绝</a-button>
                </a-space>
                <a-tag v-else :color="statusColorMap[request.status] || 'default'">{{ statusLabelMap[request.status] || request.status }}</a-tag>
            </div>
            <a-empty v-if="!chatFriendshipState.receivedRequests.length" description="暂无收到的好友申请" />
        </div>

        <a-divider orientation="left">发出的好友申请</a-divider>
        <div class="notice-list">
            <div v-for="request in chatFriendshipState.sentRequests" :key="`sent-${request.id}`" class="notice-item notice-item--request">
                <div>
                    <div class="notice-item__title">{{ request.to_user.display_name || request.to_user.username }}</div>
                    <div class="notice-item__desc">{{ request.request_message || '未填写附言' }}</div>
                    <div class="notice-item__time">{{ formatDateTime(request.created_at) }}</div>
                </div>
                <a-space v-if="request.status === 'pending'">
                    <a-button size="small" danger @click="handleRequestAction(request.id, 'cancel')">撤销</a-button>
                </a-space>
                <a-tag v-else :color="statusColorMap[request.status] || 'default'">{{ statusLabelMap[request.status] || request.status }}</a-tag>
            </div>
            <a-empty v-if="!chatFriendshipState.sentRequests.length" description="暂无发出的好友申请" />
        </div>

        <a-divider orientation="left">处理记录</a-divider>
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
import { message } from 'ant-design-vue'
import { computed, onMounted, watch } from 'vue'
import type { ChatRequestStatus } from '@/types/chat'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

const { chatStore, formatDateTime } = useChatShell()
const chatFriendshipState = chatStore.state.friendshipState
const chatFriendship = chatStore.friendship

const statusLabelMap: Record<ChatRequestStatus, string> = {
    pending: '待处理',
    accepted: '已通过',
    rejected: '已拒绝',
    canceled: '已撤销',
    expired: '已过期',
}

const statusColorMap: Partial<Record<ChatRequestStatus, string>> = {
    accepted: 'success',
    rejected: 'error',
    canceled: 'default',
    expired: 'warning',
}

const friendNoticeItems = computed(() => {
    const received = chatFriendshipState.receivedRequests
        .filter((item) => item.status !== 'pending')
        .map((item) => ({
            id: `request-received-${item.id}`,
            sourceId: item.id,
            sourceType: 'request' as const,
            kind: 'received',
            title: `${item.from_user.display_name || item.from_user.username} 的好友申请${item.status === 'accepted' ? '已通过' : item.status === 'rejected' ? '已拒绝' : '已处理'}`,
            description: item.request_message || '无附言',
            created_at: item.handled_at || item.created_at,
        }))
    const sent = chatFriendshipState.sentRequests
        .filter((item) => item.status !== 'pending')
        .map((item) => ({
            id: `request-sent-${item.id}`,
            sourceId: item.id,
            sourceType: 'request' as const,
            kind: 'sent',
            title: `你发给 ${item.to_user.display_name || item.to_user.username} 的好友申请${item.status === 'accepted' ? '已通过' : item.status === 'rejected' ? '已拒绝' : item.status === 'canceled' ? '已撤销' : '已处理'}`,
            description: item.request_message || '无附言',
            created_at: item.handled_at || item.created_at,
        }))
    const system = chatFriendshipState.friendNoticeItems.map((item) => ({
        id: item.id,
        sourceId: item.id,
        sourceType: 'system' as const,
        kind: 'system',
        title: item.title,
        description: item.description,
        created_at: item.created_at,
    }))
    return [...received, ...sent, ...system].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
})

const loadData = async () => {
    try {
        await chatFriendship.loadFriendRequests()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载好友通知失败'))
    }
}

const handleRequestAction = async (requestId: number, action: 'accept' | 'reject' | 'cancel') => {
    try {
        await chatFriendship.handleFriendRequest(requestId, action)
        message.success('操作成功')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '处理好友申请失败'))
    }
}

watch(
    friendNoticeItems,
    (items) => {
        chatFriendship.markFriendNoticesSeen(items.filter((item) => item.sourceType === 'request').map((item) => item.sourceId as number))
        chatFriendship.markFriendSystemNoticesSeen(items.filter((item) => item.sourceType === 'system').map((item) => item.sourceId as string))
    },
    { immediate: true },
)

watch(
    () => chatFriendshipState.receivedRequests.filter((item) => item.status === 'pending').map((item) => item.id),
    (requestIds) => {
        chatFriendship.markPendingRequestsSeen(requestIds)
    },
    { immediate: true },
)

onMounted(() => {
    void loadData()
})
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

.chat-workspace__header,
.notice-item--request {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.chat-workspace__header {
    margin-bottom: 8px;
}

.chat-workspace__title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-workspace__subtitle {
    color: var(--chat-text-secondary);
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

.notice-item--request {
    align-items: flex-start;
}

.notice-item__time {
    margin-top: 4px;
    font-size: 12px;
}
</style>