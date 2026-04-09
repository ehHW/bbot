<template>
    <button type="button" class="chat-record-card" :class="{ 'chat-record-card--compact': compact }" @click.stop="emit('open')">
        <div class="chat-record-card__header">{{ record.title || '聊天记录' }}</div>
        <div class="chat-record-card__body">
            <div v-for="(entry, index) in previewItems" :key="`${entry.source_message_id || index}_${index}`" class="chat-record-card__line">
                <span class="chat-record-card__sender">{{ entry.sender_name }}:</span>
                <span class="chat-record-card__text">{{ formatPreview(entry) }}</span>
            </div>
        </div>
        <div class="chat-record-card__footer">{{ record.footer_label || '聊天记录' }}</div>
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessageRecordItem, ChatMessageRecordPayload } from '@/types/chat'
import { trimText } from '@/validators/common'

const props = withDefaults(
    defineProps<{
        record: ChatMessageRecordPayload
        compact?: boolean
    }>(),
    {
        compact: false,
    },
)

const emit = defineEmits<{
    open: []
}>()

const previewItems = computed(() => (props.record.items || []).slice(0, 4))

const formatPreview = (entry: ChatMessageRecordItem) => {
    if (entry.message_type === 'image') {
        return '[图片]'
    }
    if (entry.message_type === 'file') {
        return '[文件]'
    }
    if (entry.message_type === 'chat_record') {
        return '[聊天记录]'
    }
    return trimText((entry.content || '').replace(/\s+/g, ' ')) || '空消息'
}
</script>

<style scoped>
.chat-record-card {
    display: flex;
    flex-direction: column;
    width: min(320px, 72vw);
    min-width: 220px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--chat-panel-border) 86%, var(--chat-accent) 14%);
    border-radius: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--chat-panel-bg-strong) 92%, white 8%), var(--chat-panel-bg));
    color: var(--chat-text-primary);
    cursor: pointer;
    overflow: hidden;
    text-align: left;
}

.chat-record-card--compact {
    width: 100%;
    min-width: 0;
}

.chat-record-card__header,
.chat-record-card__footer {
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 700;
}

.chat-record-card__header {
    border-bottom: 1px solid color-mix(in srgb, var(--chat-panel-border) 78%, transparent);
}

.chat-record-card__body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
}

.chat-record-card__line {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.chat-record-card__sender {
    flex: 0 0 auto;
}

.chat-record-card__text {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.chat-record-card__footer {
    border-top: 1px solid color-mix(in srgb, var(--chat-panel-border) 78%, transparent);
    color: var(--chat-text-secondary);
}
</style>