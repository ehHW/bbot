<template>
    <section class="chat-workspace">
        <a-empty description="从左侧选择好友，或打开新朋友 / 群通知" />
    </section>
</template>

<style scoped>
.chat-workspace {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 100%;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    box-shadow: var(--chat-panel-shadow);
}
</style>
