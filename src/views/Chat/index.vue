<template>
    <div class="chat-page">
        <section
            ref="chatShellRef"
            class="chat-shell"
            :style="chatShellStyle"
        >
            <div
                class="chat-shell__panel chat-shell__panel--list"
                :style="listPanelStyle"
            >
                <RouterView :key="listRouteKey" name="list" />
            </div>
            <button
                type="button"
                class="chat-shell__gutter"
                aria-label="调整会话列表宽度"
                @mousedown="startDrag('list', $event)"
            ></button>
            <div class="chat-shell__panel chat-shell__panel--workspace">
                <RouterView :key="workspaceRouteKey" />
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { RouterView, useRoute } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useChatShell } from "@/views/Chat/useChatShell";

useChatShell({ bootstrap: true });

type DragTarget = "list";

const GUTTER_WIDTH = 1;
const LIST_MIN_WIDTH = 260;
const LIST_MAX_WIDTH = 480;
const WORKSPACE_MIN_WIDTH = 520;

const route = useRoute();
const settingsStore = useSettingsStore();
const chatShellRef = ref<HTMLElement | null>(null);
const dragState = ref<{
    target: DragTarget;
    startX: number;
    listWidth: number;
} | null>(null);

const listPanelStyle = computed(() => ({
    width: `${settingsStore.chatLayout.listWidth}px`,
}));
const chatShellStyle = computed(() => ({
    "--chat-list-width": `${settingsStore.chatLayout.listWidth}px`,
}));
const listRouteKey = computed(
    () => `list:${String(route.name || route.fullPath)}`,
);
const workspaceRouteKey = computed(
    () => `workspace:${String(route.name || route.fullPath)}`,
);

const persistLayout = () => {
    void settingsStore.saveChatPreferences({
        chatLayout: settingsStore.chatLayout,
    });
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const saveLayout = (next: { menuWidth?: number; listWidth?: number }) => {
    settingsStore.save({
        chatLayout: {
            ...settingsStore.chatLayout,
            ...next,
        },
    });
};

const handleDragMove = (event: MouseEvent) => {
    if (!dragState.value || !chatShellRef.value) {
        return;
    }
    const shellWidth = chatShellRef.value.clientWidth;
    const deltaX = event.clientX - dragState.value.startX;

    const maxListWidth = Math.min(
        LIST_MAX_WIDTH,
        shellWidth - GUTTER_WIDTH - WORKSPACE_MIN_WIDTH,
    );
    saveLayout({
        listWidth: clamp(
            dragState.value.listWidth + deltaX,
            LIST_MIN_WIDTH,
            Math.max(LIST_MIN_WIDTH, maxListWidth),
        ),
    });
};

const stopDrag = () => {
    if (!dragState.value) {
        return;
    }
    dragState.value = null;
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", stopDrag);
    persistLayout();
};

const startDrag = (target: DragTarget, event: MouseEvent) => {
    event.preventDefault();
    dragState.value = {
        target,
        startX: event.clientX,
        listWidth: settingsStore.chatLayout.listWidth,
    };
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", stopDrag);
};

onBeforeUnmount(() => {
    stopDrag();
});
</script>

<style scoped>
.chat-page {
    height: 100%;
    min-width: 0;
    padding: 0;
    background: var(--chat-page-bg);
}
.chat-shell {
    display: flex;
    align-items: stretch;
    width: 100%;
    height: 100%;
}
.chat-shell__panel {
    flex: 0 0 auto;
    min-width: 0;
    display: flex;
    height: 100%;
}
.chat-shell__panel > * {
    flex: 1 1 auto;
    min-width: 0;
}
.chat-shell__panel--list {
    flex: 0 0 var(--chat-list-width);
}
.chat-shell__panel--workspace {
    flex: 1 1 auto;
    min-width: 0;
}
.chat-shell__gutter {
    position: relative;
    flex: 0 0 1px;
    padding: 0;
    border: 0;
    background: color-mix(in srgb, var(--chat-panel-border) 88%, transparent);
    cursor: col-resize;
}
.chat-shell__gutter::before {
    content: none;
}
.chat-shell__gutter:hover {
    background: color-mix(in srgb, var(--chat-accent) 72%, var(--chat-panel-border));
}
</style>
