<template>
    <div class="chat-page">
        <section class="chat-shell">
            <ChatMenu />
            <RouterView name="list" />
            <RouterView />
        </section>
    </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ChatMenu from '@/views/Chat/components/ChatMenu.vue'
import { useChatShell } from '@/views/Chat/useChatShell'

useChatShell({ bootstrap: true })
</script>

<style>
.chat-page {
    --chat-page-bg: linear-gradient(180deg, #f5f7fb 0%, #eef3f9 100%);
    --chat-panel-bg: rgba(255, 255, 255, 0.92);
    --chat-panel-bg-strong: #ffffff;
    --chat-panel-border: rgba(15, 23, 42, 0.08);
    --chat-panel-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    --chat-text-primary: #1f2937;
    --chat-text-secondary: rgba(31, 41, 55, 0.62);
    --chat-accent: #1677ff;
    --chat-accent-soft: rgba(22, 119, 255, 0.12);
    --chat-subtle-bg: rgba(148, 163, 184, 0.12);
    --chat-message-bg: #ffffff;
    --chat-message-self-bg: linear-gradient(135deg, #1677ff, #0f5ad1);
    --chat-message-self-text: #f8fbff;
    --chat-system-bg: rgba(15, 23, 42, 0.08);
    height: 100%;
    padding: 4px 0;
    background: var(--chat-page-bg);
}

html[data-theme='dark'] .chat-page {
    --chat-page-bg: linear-gradient(180deg, #0f172a 0%, #111827 100%);
    --chat-panel-bg: rgba(17, 24, 39, 0.9);
    --chat-panel-bg-strong: rgba(15, 23, 42, 0.96);
    --chat-panel-border: rgba(148, 163, 184, 0.18);
    --chat-panel-shadow: 0 16px 42px rgba(2, 6, 23, 0.42);
    --chat-text-primary: #e5eefc;
    --chat-text-secondary: rgba(226, 232, 240, 0.66);
    --chat-accent: #60a5fa;
    --chat-accent-soft: rgba(96, 165, 250, 0.16);
    --chat-subtle-bg: rgba(148, 163, 184, 0.1);
    --chat-message-bg: rgba(30, 41, 59, 0.94);
    --chat-message-self-bg: linear-gradient(135deg, #2563eb, #1d4ed8);
    --chat-message-self-text: #eff6ff;
    --chat-system-bg: rgba(148, 163, 184, 0.16);
}

.chat-shell {
    display: grid;
    grid-template-columns: 60px 320px minmax(0, 1fr);
    gap: 5px;
    height: 100%;
}

@media (max-width: 960px) {
    .chat-page {
        height: auto;
    }

    .chat-shell {
        grid-template-columns: 1fr;
        height: auto;
    }
}
</style>
