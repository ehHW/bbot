<template>
    <a-modal
        v-for="viewer in viewerStack"
        :key="viewer.id"
        :open="viewer.open"
        :title="viewer.record.title || '聊天记录'"
        :footer="null"
        :width="760"
        @update:open="handleViewerOpenChange(viewer.id, $event)"
        @cancel="emit('close-viewer', viewer.id)"
        @afterClose="emit('remove-viewer', viewer.id)"
    >
        <ChatRecordViewer
            :record="viewer.record"
            @open-record="emit('open-record', $event)"
            @copy-entry="emit('copy-entry', $event)"
            @forward-entry="emit('forward-entry', $event)"
        />
    </a-modal>
</template>

<script setup lang="ts">
import ChatRecordViewer from '@/views/Chat/components/ChatRecordViewer.vue'
import type { ChatMessageRecordItem, ChatMessageRecordPayload } from '@/types/chat'
import type { ChatRecordViewerState } from '@/modules/chat-center/composables/useChatWorkspaceRecords'

defineProps<{
    viewerStack: ChatRecordViewerState[]
}>()

const emit = defineEmits<{
    'open-record': [record: ChatMessageRecordPayload]
    'close-viewer': [viewerId: number]
    'remove-viewer': [viewerId: number]
    'copy-entry': [entry: ChatMessageRecordItem]
    'forward-entry': [entry: ChatMessageRecordItem]
}>()

const handleViewerOpenChange = (viewerId: number, open: boolean) => {
    if (!open) {
        emit('close-viewer', viewerId)
    }
}
</script>