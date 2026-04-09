<template>
    <div class="chat-record-viewer">
        <div class="chat-record-viewer__list">
            <div
                v-for="(entry, index) in record.items"
                :key="`${entry.source_message_id || index}_${index}`"
                class="chat-record-viewer__row"
                @contextmenu.prevent="openEntryMenu($event, entry)"
            >
                <a-avatar class="chat-record-viewer__avatar" :src="entry.sender_avatar || undefined">
                    {{ avatarText(entry.sender_name || '?') }}
                </a-avatar>
                <div class="chat-record-viewer__bubble-wrap">
                    <div class="chat-record-viewer__sender">{{ entry.sender_name }}</div>
                    <div class="chat-record-viewer__bubble">
                        <template v-if="entry.message_type === 'chat_record' && entry.chat_record">
                            <ChatRecordCard compact :record="entry.chat_record" @open="emit('open-record', entry.chat_record)" />
                        </template>
                        <template v-else-if="entry.message_type === 'image' || entry.message_type === 'file'">
                            <button type="button" class="chat-record-viewer__asset" @click="openAsset(entry)">
                                <img v-if="entry.message_type === 'image' && entry.asset?.url" :src="entry.asset.url" :alt="entry.asset.display_name" class="chat-record-viewer__asset-preview" />
                                <div v-if="entry.message_type === 'image' && entry.asset?.url" class="chat-record-viewer__asset-body">
                                    <span class="chat-record-viewer__asset-name">{{ entry.asset?.display_name || entry.content || '图片' }}</span>
                                    <span class="chat-record-viewer__asset-size">{{ formatAssetSize(entry.asset?.file_size) }}</span>
                                </div>
                                <div v-else class="chat-record-viewer__asset-file">
                                    <span class="chat-record-viewer__asset-icon">文件</span>
                                    <div class="chat-record-viewer__asset-file-body">
                                        <span class="chat-record-viewer__asset-name">{{ entry.asset?.display_name || entry.content || '附件' }}</span>
                                        <span class="chat-record-viewer__asset-size">{{ formatAssetSize(entry.asset?.file_size) }}</span>
                                    </div>
                                </div>
                            </button>
                        </template>
                        <template v-else>
                            <div class="chat-record-viewer__text">{{ entry.content || '空消息' }}</div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <transition name="record-entry-menu-fade">
            <div v-if="entryMenuOpen && entryMenuItem" class="chat-record-viewer__menu" :style="entryMenuStyle">
                <button type="button" class="chat-record-viewer__menu-item" @click="handleCopyEntry">复制</button>
                <button type="button" class="chat-record-viewer__menu-item" @click="handleForwardEntry">转发</button>
            </div>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ChatRecordCard from '@/views/Chat/components/ChatRecordCard.vue'
import type { ChatMessageRecordItem, ChatMessageRecordPayload } from '@/types/chat'
import { formatFileSize } from '@/utils/fileFormatter'

const props = defineProps<{
    record: ChatMessageRecordPayload
}>()

const emit = defineEmits<{
    'open-record': [record: ChatMessageRecordPayload]
    'copy-entry': [entry: ChatMessageRecordItem]
    'forward-entry': [entry: ChatMessageRecordItem]
}>()

const entryMenuOpen = ref(false)
const entryMenuItem = ref<ChatMessageRecordItem | null>(null)
const entryMenuPosition = ref({ x: 0, y: 0 })

const avatarText = (value: string) => (value || '?').trim().slice(0, 1).toUpperCase()

const entryMenuStyle = computed(() => ({ left: `${entryMenuPosition.value.x}px`, top: `${entryMenuPosition.value.y}px` }))

const formatAssetSize = (fileSize?: number) => {
    if (!fileSize || fileSize <= 0) {
        return '大小未知'
    }
    return formatFileSize(fileSize)
}

const isPreviewableAsset = (entry: ChatMessageRecordItem) => {
    if (entry.message_type === 'image') {
        return true
    }
    const mediaType = String(entry.asset?.media_type || '').trim().toLowerCase()
    const mimeType = String(entry.asset?.mime_type || '').trim().toLowerCase()
    return mediaType === 'video' || mediaType === 'audio' || mimeType.startsWith('video/') || mimeType.startsWith('audio/')
}

const triggerAssetDownload = (entry: ChatMessageRecordItem) => {
    const url = entry.asset?.url || ''
    if (!url) {
        return
    }
    const link = document.createElement('a')
    link.href = url
    link.download = entry.asset?.display_name || entry.content || '附件'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

const closeEntryMenu = () => {
    entryMenuOpen.value = false
    entryMenuItem.value = null
}

const openEntryMenu = (event: MouseEvent, entry: ChatMessageRecordItem) => {
    entryMenuItem.value = entry
    entryMenuPosition.value = {
        x: Math.max(12, event.clientX),
        y: Math.max(12, event.clientY),
    }
    entryMenuOpen.value = true
}

const handleWindowClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.chat-record-viewer__menu')) {
        return
    }
    closeEntryMenu()
}

const handleCopyEntry = () => {
    if (!entryMenuItem.value) {
        return
    }
    emit('copy-entry', entryMenuItem.value)
    closeEntryMenu()
}

const handleForwardEntry = () => {
    if (!entryMenuItem.value) {
        return
    }
    emit('forward-entry', entryMenuItem.value)
    closeEntryMenu()
}

const openAsset = (entry: ChatMessageRecordItem) => {
    const url = entry.asset?.url || ''
    if (!url) {
        return
    }
    if (!isPreviewableAsset(entry)) {
        triggerAssetDownload(entry)
        return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
}

window.addEventListener('click', handleWindowClick)

onBeforeUnmount(() => {
    window.removeEventListener('click', handleWindowClick)
})
</script>

<style scoped>
.chat-record-viewer {
    position: relative;
}

.chat-record-viewer__list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 62vh;
    overflow-y: auto;
    padding-right: 4px;
}

.chat-record-viewer__row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.chat-record-viewer__avatar {
    flex: 0 0 auto;
    margin-top: 2px;
}

.chat-record-viewer__bubble-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    max-width: min(80%, 560px);
}

.chat-record-viewer__sender {
    padding: 0 2px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    line-height: 1.2;
}

.chat-record-viewer__bubble {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    max-width: min(100%, 560px);
}

.chat-record-viewer__text,
.chat-record-viewer__asset {
    display: block;
    width: fit-content;
    max-width: 100%;
    padding: 12px 14px;
    border-radius: 18px 18px 18px 6px;
    background: var(--chat-message-bg);
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
    color: var(--chat-text-primary);
    text-align: left;
}

.chat-record-viewer__text {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.6;
}

.chat-record-viewer__asset {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(360px, 100%);
    min-width: min(300px, 100%);
    cursor: pointer;
    border: none;
}

.chat-record-viewer__bubble :deep(.chat-record-card) {
    max-width: 100%;
    border-radius: 18px 18px 18px 6px;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
}

.chat-record-viewer__asset-preview {
    display: block;
    max-width: min(280px, 100%);
    max-height: 220px;
    border-radius: 14px;
    object-fit: cover;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
}

.chat-record-viewer__asset-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    box-sizing: border-box;
}

.chat-record-viewer__asset-file {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    box-sizing: border-box;
}

.chat-record-viewer__asset-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(47, 57, 69, 0.1);
    font-size: 12px;
    font-weight: 700;
    flex: 0 0 auto;
}

.chat-record-viewer__asset-file-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

.chat-record-viewer__asset-name {
    font-weight: 600;
    line-height: 1.5;
    word-break: break-word;
}

.chat-record-viewer__asset-size {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
}

.chat-record-viewer__menu {
    position: fixed;
    z-index: 2400;
    min-width: 132px;
    padding: 6px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    background: var(--chat-panel-bg-strong);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
}

.chat-record-viewer__menu-item {
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--chat-text-primary);
    cursor: pointer;
    text-align: left;
}

.chat-record-viewer__menu-item:hover {
    background: color-mix(in srgb, var(--chat-accent-soft) 78%, var(--chat-panel-bg-strong));
}

.record-entry-menu-fade-enter-active,
.record-entry-menu-fade-leave-active {
    transition: opacity 0.16s ease, transform 0.16s ease;
}

.record-entry-menu-fade-enter-from,
.record-entry-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
}
</style>