<template>
    <a-card class="chat" title="聊天室（预留）">
        <a-alert :type="connected ? 'success' : 'warning'" :message="connected ? `已连接（${status}）` : `未连接（${status}）`" show-icon />
        <div class="toolbar">
            <a-input v-model:value="text" placeholder="输入要发送的消息" />
            <a-button type="primary" @click="sendMessage" :disabled="!connected">发送</a-button>
        </div>
        <a-list bordered :data-source="logs" size="small" class="log-list">
            <template #renderItem="{ item }">
                <a-list-item>{{ item }}</a-list-item>
            </template>
        </a-list>
    </a-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { globalWebSocket } from '@/utils/websocket'

const text = ref('')
const connected = computed(() => globalWebSocket.connected.value)
const status = computed(() => globalWebSocket.status.value)
const logs = computed(() => globalWebSocket.logs.value)

const sendMessage = () => {
    if (!text.value.trim()) {
        return
    }
    globalWebSocket.send({
        type: 'message',
        message: text.value,
        timestamp: Date.now(),
    })
    text.value = ''
}
</script>

<style scoped>
.chat {
    height: 100%;
}

.toolbar {
    margin: 12px 0;
    display: grid;
    grid-template-columns: 1fr 100px;
    gap: 8px;
}

:deep(.ant-card-body) {
    height: calc(100% - 57px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.log-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
}
</style>
