<template>
    <div class="chat-record-viewer">
        <div class="chat-record-viewer__list">
            <div
                v-for="(entry, index) in record.items"
                :key="`${entry.source_message_id || index}_${index}`"
                class="chat-record-viewer__row"
                @contextmenu.prevent="openEntryMenu($event, entry)"
            >
                <a-avatar
                    class="chat-record-viewer__avatar"
                    :src="entry.sender_avatar || undefined"
                >
                    {{ avatarText(entry.sender_name || "?") }}
                </a-avatar>
                <div class="chat-record-viewer__bubble-wrap">
                    <div class="chat-record-viewer__sender">
                        {{ entry.sender_name }}
                    </div>
                    <div class="chat-record-viewer__bubble">
                        <template
                            v-if="
                                entry.message_type === 'chat_record' &&
                                entry.chat_record
                            "
                        >
                            <ChatRecordCard
                                compact
                                :record="entry.chat_record"
                                @open="emit('open-record', entry.chat_record)"
                            />
                        </template>
                        <template
                            v-else-if="
                                entry.message_type === 'image' ||
                                entry.message_type === 'file'
                            "
                        >
                            <button
                                type="button"
                                class="chat-record-viewer__asset"
                                @click="openAsset(entry)"
                            >
                                <ChatAssetCard
                                    :preview="getEntryPreview(entry)"
                                    :show-media-meta="hasMediaPreview(entry)"
                                    :show-playable-overlay="
                                        showVideoPlayOverlay(entry)
                                    "
                                />
                            </button>
                        </template>
                        <template v-else>
                            <div class="chat-record-viewer__text">
                                {{ entry.content || "空消息" }}
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <transition name="record-entry-menu-fade">
            <div
                v-if="entryMenuOpen && entryMenuItem"
                class="chat-record-viewer__menu"
                :style="entryMenuStyle"
            >
                <button
                    type="button"
                    class="chat-record-viewer__menu-item"
                    @click="handleCopyEntry"
                >
                    复制
                </button>
                <button
                    type="button"
                    class="chat-record-viewer__menu-item"
                    @click="handleForwardEntry"
                >
                    转发
                </button>
            </div>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
    buildAssetPreviewFromChatRecordEntry,
    canAssetPreviewImage,
    canAssetPreviewVideo,
    getAssetPreviewPrimaryUrl,
    isPreviewableAssetPreview,
} from "@/utils/assetPreview";
import ChatAssetCard from "@/views/Chat/components/ChatAssetCard.vue";
import ChatRecordCard from "@/views/Chat/components/ChatRecordCard.vue";
import type {
    ChatMessageRecordItem,
    ChatMessageRecordPayload,
} from "@/types/chat";

const props = defineProps<{
    record: ChatMessageRecordPayload;
}>();

const emit = defineEmits<{
    "open-record": [record: ChatMessageRecordPayload];
    "copy-entry": [entry: ChatMessageRecordItem];
    "forward-entry": [entry: ChatMessageRecordItem];
}>();

const entryMenuOpen = ref(false);
const entryMenuItem = ref<ChatMessageRecordItem | null>(null);
const entryMenuPosition = ref({ x: 0, y: 0 });

const avatarText = (value: string) =>
    (value || "?").trim().slice(0, 1).toUpperCase();

const entryMenuStyle = computed(() => ({
    left: `${entryMenuPosition.value.x}px`,
    top: `${entryMenuPosition.value.y}px`,
}));

const getEntryPreview = (entry: ChatMessageRecordItem) =>
    buildAssetPreviewFromChatRecordEntry(entry);

const hasMediaPreview = (entry: ChatMessageRecordItem) => {
    const preview = getEntryPreview(entry);
    return canAssetPreviewImage(preview) || canAssetPreviewVideo(preview);
};

const showVideoPlayOverlay = (entry: ChatMessageRecordItem) =>
    canAssetPreviewVideo(getEntryPreview(entry));

const getEntryPreviewUrl = (entry: ChatMessageRecordItem) => {
    return getAssetPreviewPrimaryUrl(getEntryPreview(entry));
};

const isPreviewableAsset = (entry: ChatMessageRecordItem) => {
    return isPreviewableAssetPreview(getEntryPreview(entry));
};

const triggerAssetDownload = (entry: ChatMessageRecordItem) => {
    const url = getEntryPreviewUrl(entry);
    if (!url) {
        return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = getEntryPreview(entry).displayName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const closeEntryMenu = () => {
    entryMenuOpen.value = false;
    entryMenuItem.value = null;
};

const openEntryMenu = (event: MouseEvent, entry: ChatMessageRecordItem) => {
    entryMenuItem.value = entry;
    entryMenuPosition.value = {
        x: Math.max(12, event.clientX),
        y: Math.max(12, event.clientY),
    };
    entryMenuOpen.value = true;
};

const handleWindowClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".chat-record-viewer__menu")) {
        return;
    }
    closeEntryMenu();
};

const handleCopyEntry = () => {
    if (!entryMenuItem.value) {
        return;
    }
    emit("copy-entry", entryMenuItem.value);
    closeEntryMenu();
};

const handleForwardEntry = () => {
    if (!entryMenuItem.value) {
        return;
    }
    emit("forward-entry", entryMenuItem.value);
    closeEntryMenu();
};

const openAsset = (entry: ChatMessageRecordItem) => {
    const url = getEntryPreviewUrl(entry);
    if (!url) {
        return;
    }
    if (!isPreviewableAsset(entry)) {
        triggerAssetDownload(entry);
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
};

window.addEventListener("click", handleWindowClick);

onBeforeUnmount(() => {
    window.removeEventListener("click", handleWindowClick);
});
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
    display: block;
    width: min(360px, 100%);
    min-width: min(300px, 100%);
    padding: 0;
    background: transparent;
    color: inherit;
    box-shadow: none;
    cursor: pointer;
    border: none;
}

.chat-record-viewer__bubble :deep(.chat-record-card) {
    max-width: 100%;
    border-radius: 18px 18px 18px 6px;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
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
    background: color-mix(
        in srgb,
        var(--chat-accent-soft) 78%,
        var(--chat-panel-bg-strong)
    );
}

.record-entry-menu-fade-enter-active,
.record-entry-menu-fade-leave-active {
    transition:
        opacity 0.16s ease,
        transform 0.16s ease;
}

.record-entry-menu-fade-enter-from,
.record-entry-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
}
</style>
