<template>
    <section class="chat-workspace">
        <a-card :bordered="false" class="shortcut-card">
            <a-form layout="vertical">
                <a-form-item label="发送消息快捷键">
                    <a-radio-group :value="settingsStore.chatSendHotkey" @update:value="handleHotkeyChange">
                        <a-radio value="enter">Enter 发送</a-radio>
                        <a-radio value="ctrl_enter">Ctrl + Enter 发送</a-radio>
                    </a-radio-group>
                </a-form-item>
            </a-form>
            <div class="shortcut-tip">当前选择：{{ settingsStore.chatSendHotkey === 'enter' ? 'Enter' : 'Ctrl + Enter' }}</div>
        </a-card>
    </section>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { getErrorMessage } from '@/utils/error'
import { useChatShell } from '@/views/Chat/useChatShell'

const { settingsStore } = useChatShell()

const handleHotkeyChange = async (value: 'enter' | 'ctrl_enter') => {
    try {
        await settingsStore.saveChatPreferences({ chatSendHotkey: value })
        message.success('聊天快捷键已更新')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '保存聊天快捷键失败'))
    }
}
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

.chat-workspace__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.chat-workspace__title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.shortcut-tip {
    color: var(--chat-text-secondary);
}

.shortcut-card {
    background: var(--chat-panel-bg-strong);
}
</style>