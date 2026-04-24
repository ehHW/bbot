<template>
    <section class="chat-workspace">
        <a-card :bordered="false" class="notification-card">
            <div class="notification-card__header">
                <div class="notification-card__title">聊天通知</div>
                <div class="notification-card__desc">
                    关闭后，将不再接收聊天模块的全局通知提醒。
                </div>
            </div>

            <a-form layout="vertical">
                <a-form-item label="接收聊天通知">
                    <a-switch
                        :checked="settingsStore.chatReceiveNotification"
                        checked-children="开启"
                        un-checked-children="关闭"
                        @change="handleNotificationChange"
                    />
                </a-form-item>
            </a-form>
        </a-card>
    </section>
</template>

<script setup lang="ts">
import { message } from "ant-design-vue";
import { getErrorMessage } from "@/utils/error";
import { useChatShell } from "@/views/Chat/useChatShell";

const { settingsStore } = useChatShell();

const handleNotificationChange = async (checked: boolean) => {
    try {
        await settingsStore.saveChatPreferences({
            chatReceiveNotification: checked,
        });
        message.success(checked ? "已开启聊天通知" : "已关闭聊天通知");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "保存聊天通知设置失败"));
    }
};
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

.notification-card {
    background: var(--chat-panel-bg-strong);
}

.notification-card__header {
    margin-bottom: 18px;
}

.notification-card__title {
    font-size: 20px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.notification-card__desc {
    margin-top: 8px;
    color: var(--chat-text-secondary);
    line-height: 1.7;
}
</style>
