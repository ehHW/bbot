<template>
    <section class="chat-workspace">
        <header class="chat-workspace__header">
            <div>
                <div class="chat-workspace__title">群通知</div>
                <div class="chat-workspace__subtitle">展示入群申请与群聊相关通知</div>
            </div>
        </header>

        <a-divider orientation="left">入群申请</a-divider>
        <div class="drawer-list">
            <div v-for="request in chatGroupState.globalGroupJoinRequests" :key="request.id" class="drawer-list-item request-item">
                <div>
                    <div class="drawer-list-title">{{ request.target_user.display_name || request.target_user.username }} 申请加入群聊</div>
                    <div class="drawer-list-desc">群聊 #{{ request.conversation_id }} · {{ formatDateTime(request.created_at) }}</div>
                </div>
                <a-space>
                    <a-button size="small" type="primary" @click="handleJoinRequestAction(request.id, 'approve', request.conversation_id)">通过</a-button>
                    <a-button size="small" @click="handleJoinRequestAction(request.id, 'reject', request.conversation_id)">拒绝</a-button>
                </a-space>
            </div>
            <a-empty v-if="!chatGroupState.globalGroupJoinRequests.length" description="暂无待处理入群申请" />
        </div>

        <a-divider orientation="left">群消息</a-divider>
        <div class="drawer-list">
            <div v-for="notice in chatGroupState.groupNoticeItems" :key="notice.id" class="drawer-list-item">
                <div>
                    <div class="drawer-list-title">{{ notice.message }}</div>
                    <div class="drawer-list-desc">{{ formatDateTime(notice.created_at) }}</div>
                </div>
                <a-button v-if="notice.conversation_id" size="small" @click="openConversation(notice.conversation_id)">查看会话</a-button>
            </div>
            <a-empty v-if="!chatGroupState.groupNoticeItems.length" description="暂无群通知" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatShell } from '@/views/Chat/useChatShell'
import { getErrorMessage } from '@/utils/error'

const router = useRouter()
const { chatStore, formatDateTime } = useChatShell()
const chatGroupState = chatStore.state.groupState
const chatConversationState = chatStore.state.conversationState
const chatGroup = chatStore.group
const chatConversation = chatStore.conversation

const loadData = async () => {
    try {
        await chatGroup.loadGlobalGroupJoinRequests()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载群通知失败'))
    }
}

const handleJoinRequestAction = async (requestId: number, action: 'approve' | 'reject', conversationId: number) => {
    try {
        await chatGroup.handleJoinRequest(requestId, action, conversationId)
        await chatGroup.loadGlobalGroupJoinRequests()
        message.success('审批已处理')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '处理入群申请失败'))
    }
}

const openConversation = async (conversationId: number) => {
    const target = chatConversationState.conversations.find((item) => item.id === conversationId)
    if (target) {
        await chatConversation.selectConversation(conversationId)
    }
    await router.push({ name: 'ChatMessages' })
}

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
.chat-workspace__header,.drawer-list-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.chat-workspace__header { margin-bottom: 8px; }
.chat-workspace__title,.drawer-list-title { font-size: 20px; font-weight: 700; color: var(--chat-text-primary); }
.chat-workspace__subtitle,.drawer-list-desc { color: var(--chat-text-secondary); }
.drawer-list { display: flex; flex-direction: column; gap: 10px; }
.drawer-list-item { padding: 12px 14px; border: 1px solid var(--chat-panel-border); border-radius: 12px; background: var(--chat-panel-bg-strong); }
.request-item { align-items: flex-start; }
</style>
