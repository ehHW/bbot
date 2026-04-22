<template>
    <div class="chat-page">
        <section v-if="isMobileLayout" class="chat-mobile">
            <div
                class="chat-mobile__content"
                :class="{
                    'chat-mobile__content--detail': isMobileDetail,
                    'chat-mobile__content--with-tabs': showMobileTabs,
                }"
            >
                <RouterView :key="mobileRouteKey" />
            </div>

            <nav
                v-if="showMobileTabs"
                class="chat-mobile-tabs"
                aria-label="聊天室底部导航"
            >
                <button
                    v-for="item in mobileTabItems"
                    :key="item.key"
                    type="button"
                    class="chat-mobile-tabs__item"
                    :class="{ active: activeMobileTab === item.key }"
                    @click="switchMobileTab(item.key)"
                >
                    {{ item.label }}
                </button>
            </nav>
        </section>

        <section
            v-else
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { useChatShell } from "@/views/Chat/useChatShell";
import {
    CHAT_MOBILE_ROUTE,
    type ChatMobileTab,
    isMobileChatDevice,
    isMobileChatRouteName,
} from "@/views/Chat/chatLayout";

useChatShell({ bootstrap: true });

type DragTarget = "list";

const GUTTER_WIDTH = 1;
const LIST_MIN_WIDTH = 260;
const LIST_MAX_WIDTH = 480;
const WORKSPACE_MIN_WIDTH = 520;

const route = useRoute();
const router = useRouter();
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
const mobileRouteKey = computed(
    () => `mobile:${String(route.name || route.fullPath)}`,
);
const isMobileLayout = computed(() => isMobileChatDevice());
const activeMobileTab = computed<ChatMobileTab>(() => {
    const tab = route.meta.mobileTab;
    if (tab === "contacts" || tab === "settings") {
        return tab;
    }
    return "messages";
});
const isMobileDetail = computed(() => route.meta.mobileDetail === true);
const showMobileTabs = computed(() => !isMobileDetail.value);

const mobileTabItems: Array<{ key: ChatMobileTab; label: string }> = [
    { key: "messages", label: "消息" },
    { key: "contacts", label: "联系人" },
    { key: "settings", label: "设置" },
];

const mapMobileRouteToDesktop = (routeName: string) => {
    switch (routeName) {
        case CHAT_MOBILE_ROUTE.messagesList:
        case CHAT_MOBILE_ROUTE.messagesDetail:
            return "ChatMessages";
        case CHAT_MOBILE_ROUTE.contactsList:
        case CHAT_MOBILE_ROUTE.contactsFriendNotices:
            return "ChatContactsFriendNotices";
        case CHAT_MOBILE_ROUTE.contactsNotices:
            return "ChatContactsNotices";
        case CHAT_MOBILE_ROUTE.settingsList:
        case CHAT_MOBILE_ROUTE.settingsShortcuts:
            return "ChatSettingsShortcuts";
        case CHAT_MOBILE_ROUTE.settingsInspect:
            return "ChatSettingsInspect";
        default:
            return "ChatMessages";
    }
};

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
    if (
        !dragState.value ||
        !chatShellRef.value ||
        window.innerWidth <= 960 ||
        isMobileLayout.value
    ) {
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
    if (window.innerWidth <= 960 || isMobileLayout.value) {
        return;
    }
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

const switchMobileTab = async (tab: ChatMobileTab) => {
    const routeNameByTab: Record<ChatMobileTab, string> = {
        messages: CHAT_MOBILE_ROUTE.messagesList,
        contacts: CHAT_MOBILE_ROUTE.contactsList,
        settings: CHAT_MOBILE_ROUTE.settingsList,
    };
    const targetName = routeNameByTab[tab];
    if (route.name !== targetName) {
        await router.push({ name: targetName });
    }
};

watch(
    () => [isMobileLayout.value, String(route.name || "")],
    async ([mobile, routeName]) => {
        const routeNameText = String(routeName || "");
        if (!mobile) {
            if (isMobileChatRouteName(routeNameText)) {
                await router.replace({
                    name: mapMobileRouteToDesktop(routeNameText),
                });
            }
            return;
        }
        if (isMobileChatRouteName(routeNameText)) {
            return;
        }
        if (routeNameText.startsWith("ChatContacts")) {
            await router.replace({ name: CHAT_MOBILE_ROUTE.contactsList });
            return;
        }
        if (routeNameText.startsWith("ChatSettings")) {
            await router.replace({ name: CHAT_MOBILE_ROUTE.settingsList });
            return;
        }
        await router.replace({ name: CHAT_MOBILE_ROUTE.messagesList });
    },
    { immediate: true },
);
</script>

<style scoped></style>
