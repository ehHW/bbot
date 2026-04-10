<template>
    <a-modal :open="forwardModalOpen" title="选择聊天" :footer="null" :width="modalWidth" @update:open="emit('update:forwardModalOpen', $event)">
        <div class="forward-modal">
            <div class="forward-modal__topbar">
                <div class="forward-modal__summary">{{ forwardingMessageCount > 1 ? '已选择转发方式，请继续选择聊天目标' : '选择一个聊天目标后会继续发送这条消息' }}</div>
                <a-input :value="forwardSearchKeyword" allow-clear placeholder="搜索会话 / 好友 / 群组" class="forward-modal__search" @update:value="emit('update:forwardSearchKeyword', $event)" />
            </div>
            <div v-if="recentForwardTargets.length" class="forward-modal__section">
                <div class="forward-modal__section-title">最近转发</div>
                <div class="forward-modal__recent-grid">
                    <button
                        v-for="target in recentForwardTargets"
                        :key="target.key"
                        type="button"
                        class="forward-modal__recent-card"
                        :class="{ 'is-active': selectedForwardTargetKey === target.key }"
                        :disabled="forwarding"
                        @click="emit('select-target', target)"
                    >
                        <a-avatar :src="target.avatar || undefined" :size="44">{{ avatarText(target.name) }}</a-avatar>
                        <span class="forward-modal__recent-name">{{ target.name }}</span>
                    </button>
                </div>
            </div>
            <div class="forward-modal__section">
                <div class="forward-modal__section-title">最近聊天</div>
                <div class="forward-modal__list">
                    <button
                        v-for="target in filteredForwardTargets"
                        :key="target.key"
                        type="button"
                        class="forward-modal__item"
                        :class="{ 'is-active': selectedForwardTargetKey === target.key }"
                        :disabled="forwarding"
                        @click="emit('select-target', target)"
                    >
                        <a-avatar :src="target.avatar || undefined" :size="44">{{ avatarText(target.name) }}</a-avatar>
                        <div class="forward-modal__body">
                            <span class="forward-modal__name">{{ target.name }}</span>
                        </div>
                    </button>
                    <a-empty v-if="!filteredForwardTargets.length" description="没有匹配的聊天目标" />
                </div>
            </div>
        </div>
    </a-modal>

    <a-modal :open="forwardModeModalOpen" title="选择转发方式" :footer="null" :width="420" @update:open="emit('update:forwardModeModalOpen', $event)">
        <div class="forward-mode-modal">
            <div class="forward-mode-modal__summary">先为 {{ forwardSummary }} 选择转发方式，再选择聊天目标</div>
            <button type="button" class="forward-mode-modal__action" :disabled="forwarding" @click="emit('confirm-mode', 'separate')">
                <span class="forward-mode-modal__title">逐条转发</span>
                <span class="forward-mode-modal__desc">每条消息都以当前用户身份单独发送，不显示“转发自”</span>
            </button>
            <button type="button" class="forward-mode-modal__action" :disabled="forwarding" @click="emit('confirm-mode', 'merged')">
                <span class="forward-mode-modal__title">合并转发</span>
                <span class="forward-mode-modal__desc">把这批消息打包成一条聊天记录消息发送</span>
            </button>
        </div>
    </a-modal>
</template>

<script setup lang="ts">
import type { ForwardTargetOption } from '@/modules/chat-center/composables/useChatWorkspaceForwarding'

defineProps<{
    forwardModalOpen: boolean
    forwardModeModalOpen: boolean
    forwardingMessageCount: number
    forwardSearchKeyword: string
    selectedForwardTargetKey: string
    forwarding: boolean
    recentForwardTargets: ForwardTargetOption[]
    filteredForwardTargets: ForwardTargetOption[]
    forwardSummary: string
    pendingForwardTargetName: string
    avatarText: (value: string) => string
    modalWidth: number
}>()

const emit = defineEmits<{
    'update:forwardModalOpen': [open: boolean]
    'update:forwardModeModalOpen': [open: boolean]
    'update:forwardSearchKeyword': [keyword: string]
    'select-target': [target: ForwardTargetOption]
    'confirm-mode': [mode: 'separate' | 'merged']
}>()
</script>

<style scoped>
.forward-modal {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.forward-modal__topbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
    align-items: center;
    gap: 14px;
}

.forward-modal__summary {
    min-width: 0;
    font-size: 13px;
    color: var(--chat-text-secondary);
}

.forward-modal__search {
    width: 100%;
}

.forward-modal__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.forward-modal__section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.forward-modal__recent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 10px;
}

.forward-modal__recent-card,
.forward-modal__item {
    border: 1px solid var(--chat-panel-border);
    background: var(--chat-panel-bg-strong);
    color: var(--chat-text-primary);
    transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    cursor: pointer;
}

.forward-modal__recent-card:disabled,
.forward-modal__item:disabled {
    cursor: not-allowed;
    opacity: 0.72;
}

.forward-modal__recent-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    min-height: 116px;
    padding: 14px 10px;
    border-radius: 16px;
    text-align: center;
}

.forward-modal__recent-card:hover,
.forward-modal__item:hover,
.forward-modal__recent-card.is-active,
.forward-modal__item.is-active {
    border-color: color-mix(in srgb, var(--chat-accent) 54%, white);
    background: color-mix(in srgb, var(--chat-accent-soft) 72%, var(--chat-panel-bg-strong));
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
}

.forward-modal__recent-name,
.forward-modal__name {
    display: block;
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--chat-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.forward-modal__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 280px;
    max-height: 360px;
    overflow-y: auto;
    padding-right: 2px;
}

.forward-modal__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    text-align: left;
}

.forward-modal__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.forward-mode-modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.forward-mode-modal__summary {
    font-size: 13px;
    color: var(--chat-text-secondary);
}

.forward-mode-modal__action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    background: var(--chat-panel-bg-strong);
    color: var(--chat-text-primary);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.forward-mode-modal__action:hover {
    border-color: color-mix(in srgb, var(--chat-accent) 54%, white);
    background: color-mix(in srgb, var(--chat-accent-soft) 72%, var(--chat-panel-bg-strong));
    transform: translateY(-1px);
}

.forward-mode-modal__action:disabled {
    cursor: not-allowed;
    opacity: 0.72;
    transform: none;
}

.forward-mode-modal__title {
    font-size: 14px;
    font-weight: 700;
}

.forward-mode-modal__desc {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

@media (max-width: 900px) {
    .forward-modal__topbar {
        grid-template-columns: 1fr;
    }

    .forward-modal__search {
        max-width: none;
    }
}
</style>