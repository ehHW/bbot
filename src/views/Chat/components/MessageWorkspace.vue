<template>
    <main class="chat-main">
        <template v-if="chatStore.activeConversation">
            <header class="chat-main__header">
                <div>
                    <div class="chat-main__title">{{ chatStore.activeConversation.name }}</div>
                    <div class="chat-main__meta">
                        <span>{{ chatStore.activeConversation.type === 'group' ? `${chatStore.activeConversation.member_count} 人群聊` : '私聊' }}</span>
                        <span v-if="typingText">{{ typingText }}</span>
                    </div>
                </div>
                <a-space>
                    <template v-if="showDirectActions">
                        <a-button type="primary" ghost @click="handleAddFriend">加好友</a-button>
                    </template>
                    <a-button v-if="showSettingsTrigger" class="chat-menu-trigger" @click="openSettingsDrawer">
                        <MenuOutlined />
                    </a-button>
                </a-space>
            </header>

            <div class="chat-main__history-toolbar">
                <a-button v-if="canLoadOlderMessages" size="small" :loading="chatStore.loadingMessages" @click="handleLoadOlderMessages">加载更早消息</a-button>
            </div>

            <div ref="messageContainerRef" class="chat-main__messages">
                <div
                    v-for="messageItem in chatStore.activeMessages"
                    :key="messageItem.id"
                    class="message-row"
                    :class="messageRowClass(messageItem)"
                    :data-sequence="messageItem.sequence"
                >
                    <template v-if="messageItem.is_system">
                        <div class="system-bubble">{{ messageItem.content }}</div>
                    </template>
                    <template v-else>
                        <a-avatar v-if="!isSelfMessage(messageItem)" :src="messageItem.sender?.avatar || undefined">
                            {{ avatarText(messageItem.sender?.display_name || messageItem.sender?.username || '?') }}
                        </a-avatar>
                        <div class="message-bubble-wrap" :class="{ self: isSelfMessage(messageItem) }">
                            <div class="message-bubble__meta">
                                <span>{{ isSelfMessage(messageItem) ? '我' : (messageItem.sender?.display_name || messageItem.sender?.username || '系统') }}</span>
                                <span>{{ formatDateTime(messageItem.created_at) }}</span>
                            </div>
                            <div class="message-bubble-row" :class="{ self: isSelfMessage(messageItem) }">
                                <div v-if="isSelfMessage(messageItem) && messageItem.local_status" class="message-status message-status--inline">
                                    <span v-if="messageItem.local_status === 'sending'" class="message-status__spinner" aria-label="发送中"></span>
                                    <button v-else type="button" class="message-status__failed" @click.stop="openFailedMenu($event, messageItem)">!</button>
                                </div>
                                <div class="message-bubble" :class="{ self: isSelfMessage(messageItem) }">
                                    {{ messageItem.content }}
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <footer class="chat-main__composer">
                <a-textarea
                    v-model:value="draftMessage"
                    :disabled="!chatStore.activeConversation.can_send_message"
                    :auto-size="{ minRows: 3, maxRows: 6 }"
                    :placeholder="composerPlaceholder"
                    @input="handleDraftInput"
                    @keydown="handleComposerKeydown"
                    @blur="stopTypingSoon"
                />
                <div class="chat-main__composer-actions">
                    <a-button type="primary" :disabled="!chatStore.activeConversation.can_send_message" @click="handleSendMessage">发送</a-button>
                </div>
            </footer>
        </template>

        <a-empty v-else description="选择一个会话开始聊天" />

        <div v-if="failedMenuOpen && failedMenuMessage" class="failed-menu" :style="failedMenuStyle">
            <button type="button" class="failed-menu__item" @click="handleRetryMessage">重新发送</button>
        </div>

        <a-drawer v-model:open="groupDrawerOpen" :title="settingsDrawerTitle" :width="420" :body-style="drawerBodyStyle">
            <template v-if="chatStore.activeConversation?.type === 'group'">
                <section class="settings-section">
                    <div class="settings-section__title">群资料</div>
                    <div class="group-basic-panel">
                        <div class="group-basic-panel__fields">
                            <div class="group-summary-card">
                                <a-upload :before-upload="handleGroupAvatarUpload" :show-upload-list="false" accept="image/*">
                                    <button type="button" class="group-summary-card__avatar">
                                        <a-avatar :src="groupConfigForm.avatar || undefined" :size="56">{{ avatarText(groupConfigForm.name || chatStore.activeConversation.name) }}</a-avatar>
                                    </button>
                                </a-upload>
                                <div class="group-summary-card__body">
                                    <div class="group-summary-card__top">
                                        <template v-if="groupNameEditing">
                                            <a-input ref="groupNameInputRef" v-model:value="groupConfigForm.name" placeholder="群名称" :maxlength="150" class="group-summary-card__input group-summary-card__input--editing" @blur="handleGroupNameBlur" @press-enter="handleGroupNameEnter" @keydown.esc="handleGroupNameEscape" />
                                        </template>
                                        <template v-else>
                                            <span class="group-summary-card__name">{{ groupConfigForm.name || chatStore.activeConversation.name }}</span>
                                        </template>
                                        <button type="button" class="group-summary-card__edit" @click="toggleGroupNameEditing">
                                            <EditOutlined />
                                        </button>
                                    </div>
                                    <div class="group-summary-card__meta">群号 {{ chatStore.activeConversation.id }}</div>
                                </div>
                            </div>
                            <div class="group-config-field group-config-field--inline">
                                <span>预留群人数上限</span>
                                <a-input-number v-model:value="groupConfigForm.max_members" :min="1" :max="100000" style="width: 220px" placeholder="不限制" @blur="handleGroupMaxMembersBlur" />
                            </div>
                            <div class="group-switch-grid">
                                <div class="group-config-field">
                                    <span>入群需审批</span>
                                    <a-switch v-model:checked="groupConfigForm.join_approval_required" @change="handleGroupSwitchChange('join_approval_required', $event)" />
                                </div>
                                <div class="group-config-field">
                                    <span>允许普通成员邀请</span>
                                    <a-switch v-model:checked="groupConfigForm.allow_member_invite" @change="handleGroupSwitchChange('allow_member_invite', $event)" />
                                </div>
                                <div class="group-config-field">
                                    <span>全员禁言</span>
                                    <a-switch v-model:checked="groupConfigForm.mute_all" @change="handleGroupSwitchChange('mute_all', $event)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__header-row">
                        <div class="settings-section__title">群成员</div>
                        <button type="button" class="settings-section__link-button" @click="memberModalOpen = true">
                            <span>{{ chatStore.activeMembers.length }} 人</span>
                            <span class="settings-section__link"><RightOutlined /></span>
                        </button>
                    </div>
                    <div class="member-preview-grid">
                        <div v-for="member in previewMembers" :key="member.user.id" class="member-preview">
                            <a-avatar :src="member.user.avatar || undefined" :size="42">{{ avatarText(memberDisplayName(member)) }}</a-avatar>
                        </div>
                        <button v-if="availableInviteOptions.length" type="button" class="member-preview member-preview--add" @click="memberModalOpen = true">
                            <span class="member-preview__plus"><PlusOutlined /></span>
                        </button>
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">会话偏好</div>
                    <div class="setting-switch-row">
                        <span>设为置顶</span>
                        <a-switch :checked="pinnedConversation" @change="handlePinChange" />
                    </div>
                    <div class="setting-switch-row">
                        <span>消息免打扰</span>
                        <a-switch :checked="muteNotifications" @change="handleMuteNotificationChange" />
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">我的本群昵称</div>
                    <div class="nickname-editor">
                        <span class="nickname-editor__label">当前群内显示</span>
                        <a-input v-model:value="groupNicknameInput" :maxlength="80" placeholder="不填则显示默认昵称" @blur="handleGroupNicknameBlur" @press-enter="handleGroupNicknameEnter" />
                        <span class="nickname-editor__preview">{{ groupNicknamePreview }}</span>
                    </div>
                </section>

                <section v-if="chatStore.activeJoinRequests.length" class="settings-section">
                    <div class="settings-section__title">待审批邀请</div>
                    <div class="drawer-list">
                        <div v-for="joinRequest in chatStore.activeJoinRequests" :key="joinRequest.id" class="drawer-list-item request-item">
                            <div>
                                <div class="drawer-list-title">{{ joinRequest.target_user.display_name || joinRequest.target_user.username }}</div>
                                <div class="drawer-list-desc">{{ formatDateTime(joinRequest.created_at) }}</div>
                            </div>
                            <a-space>
                                <a-button size="small" type="primary" @click="handleJoinRequestAction(joinRequest.id, 'approve')">通过</a-button>
                                <a-button size="small" @click="handleJoinRequestAction(joinRequest.id, 'reject')">拒绝</a-button>
                            </a-space>
                        </div>
                    </div>
                </section>

                <a-button danger block class="group-leave-btn" @click="handleLeaveConversation">退出群聊</a-button>
            </template>

            <template v-else-if="chatStore.activeConversation?.type === 'direct'">
                <section class="settings-section direct-profile-card">
                    <div class="direct-profile-card__main">
                        <a-avatar :src="directTargetUser?.avatar || undefined" :size="68">{{ avatarText(directConversationTitle) }}</a-avatar>
                        <div>
                            <div class="settings-section__title">{{ directConversationTitle }}</div>
                            <div class="settings-section__desc">{{ directTargetUser?.username || '未知用户' }}</div>
                        </div>
                    </div>
                    <a-button v-if="showDirectActions" type="primary" ghost @click="handleAddFriend">加好友</a-button>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">会话偏好</div>
                    <div class="setting-switch-row">
                        <span>设为置顶</span>
                        <a-switch :checked="pinnedConversation" @change="handlePinChange" />
                    </div>
                    <div class="setting-switch-row">
                        <span>消息免打扰</span>
                        <a-switch :checked="muteNotifications" @change="handleMuteNotificationChange" />
                    </div>
                </section>

                <section class="settings-section">
                    <div class="settings-section__title">好友备注</div>
                    <template v-if="isDirectFriend && currentFriendship">
                        <div class="friend-remark-editor">
                            <div class="friend-remark-editor__top">
                                <template v-if="directRemarkEditing">
                                    <a-input ref="directRemarkInputRef" v-model:value="directRemark" :maxlength="80" placeholder="输入备注名称" class="friend-remark-editor__input" @blur="handleDirectRemarkBlur" @press-enter="handleDirectRemarkEnter" @keydown.esc="handleDirectRemarkEscape" />
                                </template>
                                <template v-else>
                                    <span class="friend-remark-editor__value">{{ directRemark || directConversationTitle }}</span>
                                </template>
                                <button type="button" class="group-summary-card__edit" @click="toggleDirectRemarkEditing">
                                    <EditOutlined />
                                </button>
                            </div>
                        </div>
                    </template>
                    <div v-else class="settings-section__desc">成为好友后可在这里设置备注。</div>
                </section>
            </template>
        </a-drawer>

        <a-modal v-model:open="memberModalOpen" title="群成员" :footer="null" width="540" :body-style="tallModalBodyStyle">
            <template v-if="chatStore.activeConversation?.type === 'group'">
                <div class="drawer-toolbar" v-if="availableInviteOptions.length">
                    <a-select v-model:value="inviteUserId" style="flex: 1" :options="availableInviteOptions" placeholder="选择好友邀请进群" />
                    <a-button type="primary" @click="handleInviteMember">添加成员</a-button>
                </div>

                <div class="drawer-list">
                    <div v-for="member in chatStore.activeMembers" :key="member.user.id" class="drawer-list-item member-item">
                        <div class="member-item__main">
                            <a-avatar :src="member.user.avatar || undefined">{{ avatarText(memberDisplayName(member)) }}</a-avatar>
                            <div>
                                <div class="drawer-list-title">{{ memberDisplayName(member) }}<span v-if="member.friend_remark">（{{ member.friend_remark }}）</span></div>
                                <div class="drawer-list-desc">
                                    <span>{{ member.user.username }}</span>
                                    <span v-if="member.mute_until"> · 禁言至 {{ formatDateTime(member.mute_until) }}</span>
                                </div>
                            </div>
                        </div>
                        <a-space>
                            <a-tag>{{ memberRoleLabel(member.role) }}</a-tag>
                            <a-button v-if="canManageMembers && member.role !== 'owner'" size="small" @click="handleMuteMember(member.user.id)">禁言10分钟</a-button>
                            <a-button v-if="canEditRoles && member.role !== 'owner'" size="small" @click="handleToggleMemberRole(member.user.id, member.role === 'admin' ? 'member' : 'admin')">
                                {{ member.role === 'admin' ? '设为成员' : '设为管理员' }}
                            </a-button>
                            <a-popconfirm v-if="canManageMembers && member.role !== 'owner'" title="确认移出该成员？" @confirm="handleRemoveMember(member.user.id)">
                                <a-button size="small" danger>移除</a-button>
                            </a-popconfirm>
                        </a-space>
                    </div>
                    <a-empty v-if="!chatStore.activeMembers.length" description="暂无成员数据" />
                </div>
            </template>
        </a-modal>

        <AvatarCropModal
            :open="avatarCropOpen"
            :image-url="avatarCropImageUrl"
            :confirm-loading="groupAvatarUploading"
            @cancel="handleAvatarCropCancel"
            @confirm="handleAvatarCropConfirm"
        />
    </main>
</template>

<script setup lang="ts">
import { EditOutlined, MenuOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarCropModal from '@/components/AvatarCropModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import type { ChatConversationMemberItem, ChatMessageItem } from '@/types/chat'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { useChatShell } from '@/views/Chat/useChatShell'
import { getErrorMessage } from '@/utils/error'
import { trimText, validateAvatarFile } from '@/validators/common'

const router = useRouter()
const authStore = useAuthStore()
const userStore = useUserStore()
const {
    avatarText,
    canEditRoles,
    canLoadOlderMessages,
    canManageMembers,
    chatStore,
    formatDateTime,
    isSelfMessage,
    messageRowClass,
    settingsStore,
    typingText,
} = useChatShell()

const draftMessage = ref('')
const groupDrawerOpen = ref(false)
const groupConfigSaving = ref(false)
const groupAvatarUploading = ref(false)
const groupNameEditing = ref(false)
const directRemarkEditing = ref(false)
const groupNameInputRef = ref<{ focus: (options?: { cursor?: 'start' | 'end' | 'all' }) => void } | null>(null)
const directRemarkInputRef = ref<{ focus: (options?: { cursor?: 'start' | 'end' | 'all' }) => void } | null>(null)
const skipNextGroupNameBlur = ref(false)
const skipNextGroupNicknameBlur = ref(false)
const skipNextDirectRemarkBlur = ref(false)
const friendRemarkSaving = ref(false)
const groupNicknameSaving = ref(false)
const inviteUserId = ref<number | null>(null)
const memberModalOpen = ref(false)
const messageContainerRef = ref<HTMLElement | null>(null)
const typingStopTimer = ref<number | null>(null)
const focusedSequenceTimer = ref<number | null>(null)
const failedMenuOpen = ref(false)
const failedMenuMessage = ref<ChatMessageItem | null>(null)
const failedMenuPosition = ref({ x: 0, y: 0 })
const muteNotifications = ref(false)
const pinnedConversation = ref(false)
const groupNicknameInput = ref('')
const directRemark = ref('')
const avatarCropOpen = ref(false)
const avatarCropImageUrl = ref('')
let avatarTempObjectUrl = ''

const drawerBodyStyle = {
    paddingBottom: '24px',
}

const tallModalBodyStyle = {
    minHeight: '54vh',
    maxHeight: '72vh',
    overflowY: 'auto' as const,
}

const groupConfigForm = reactive({
    name: '',
    avatar: '',
    join_approval_required: true,
    allow_member_invite: true,
    mute_all: false,
    max_members: null as number | null,
})

const availableInviteOptions = computed(() => {
    const currentMembers = new Set(chatStore.activeMembers.map((item) => item.user.id))
    return chatStore.friends
        .map((item) => ({
            label: `${item.friend_user.display_name || item.friend_user.username} (${item.friend_user.username})`,
            value: item.friend_user.id,
        }))
        .filter((item) => !currentMembers.has(item.value))
})

const previewMembers = computed(() => chatStore.activeMembers.slice(0, 8))

const directTargetUser = computed(() => {
    if (chatStore.activeConversation?.type !== 'direct') {
        return null
    }
    if (chatStore.activeConversation.direct_target?.id) {
        return chatStore.activeConversation.direct_target
    }
    return chatStore.friends.find((item) => item.direct_conversation?.id === chatStore.activeConversation?.id)?.friend_user || null
})

const currentFriendship = computed(() => {
    if (chatStore.activeConversation?.type !== 'direct') {
        return null
    }
    return chatStore.friends.find((item) => item.direct_conversation?.id === chatStore.activeConversation?.id) || null
})

const isDirectFriend = computed(() => {
    if (!chatStore.activeConversation || chatStore.activeConversation.type !== 'direct') {
        return false
    }
    return chatStore.friends.some((item) => item.direct_conversation?.id === chatStore.activeConversation?.id)
})

const showDirectActions = computed(
    () => chatStore.activeConversation?.type === 'direct' && chatStore.activeConversation.access_mode === 'member' && !isDirectFriend.value && Boolean(directTargetUser.value),
)
const showSettingsTrigger = computed(() => Boolean(chatStore.activeConversation && chatStore.activeConversation.access_mode === 'member'))
const settingsDrawerTitle = computed(() => (chatStore.activeConversation?.type === 'group' ? '群聊设置' : '会话设置'))
const directConversationTitle = computed(() => currentFriendship.value?.remark || directTargetUser.value?.display_name || directTargetUser.value?.username || chatStore.activeConversation?.name || '私聊')
const groupNicknamePreview = computed(() => trimText(groupNicknameInput.value) || userStore.user?.display_name || userStore.user?.username || '未设置')
const sendShortcutLabel = computed(() => (settingsStore.chatSendHotkey === 'enter' ? 'Enter' : 'Ctrl + Enter'))
const composerPlaceholder = computed(() => `输入文本消息，按 ${sendShortcutLabel.value} 发送`)
const failedMenuStyle = computed(() => ({ left: `${failedMenuPosition.value.x}px`, top: `${failedMenuPosition.value.y}px` }))

const memberRoleLabel = (role: ChatConversationMemberItem['role']) => {
    if (role === 'owner') {
        return '群主'
    }
    if (role === 'admin') {
        return '管理员'
    }
    return '成员'
}

const memberDisplayName = (member: ChatConversationMemberItem) => member.group_nickname || member.user.display_name || member.user.username

const closeFailedMenu = () => {
    failedMenuOpen.value = false
    failedMenuMessage.value = null
}

const handleDocumentClick = () => {
    closeFailedMenu()
}

const syncGroupConfigForm = () => {
    const config = chatStore.activeConversation?.group_config
    groupNameEditing.value = false
    groupConfigForm.name = chatStore.activeConversation?.name || ''
    groupConfigForm.avatar = chatStore.activeConversation?.avatar || ''
    groupConfigForm.join_approval_required = config?.join_approval_required ?? true
    groupConfigForm.allow_member_invite = config?.allow_member_invite ?? true
    groupConfigForm.mute_all = config?.mute_all ?? false
    groupConfigForm.max_members = config?.max_members ?? null
}

const syncPreferenceForm = () => {
    muteNotifications.value = chatStore.activeConversation?.member_settings?.mute_notifications ?? false
    pinnedConversation.value = chatStore.activeConversation?.is_pinned ?? false
    groupNicknameInput.value = chatStore.activeConversation?.member_settings?.group_nickname || ''
    directRemark.value = currentFriendship.value?.remark || ''
    directRemarkEditing.value = false
}

const clearCropState = () => {
    avatarCropOpen.value = false
    avatarCropImageUrl.value = ''
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }
}

const focusEditableInput = async (target: { focus: (options?: { cursor?: 'start' | 'end' | 'all' }) => void } | null) => {
    await nextTick()
    target?.focus({ cursor: 'all' })
}

const scrollToBottom = async () => {
    await nextTick()
    const element = messageContainerRef.value
    if (!element) {
        return
    }
    element.scrollTop = element.scrollHeight
}

const clearFocusedMessageHighlight = () => {
    if (focusedSequenceTimer.value) {
        window.clearTimeout(focusedSequenceTimer.value)
        focusedSequenceTimer.value = null
    }
    const element = messageContainerRef.value
    if (!element) {
        return
    }
    element.querySelectorAll('.message-row--focused').forEach((node) => node.classList.remove('message-row--focused'))
}

const scrollToSequence = async (sequence: number) => {
    await nextTick()
    const container = messageContainerRef.value
    if (!container) {
        return false
    }
    const target = container.querySelector<HTMLElement>(`.message-row[data-sequence="${sequence}"]`)
    if (!target) {
        return false
    }
    clearFocusedMessageHighlight()
    target.classList.add('message-row--focused')
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    focusedSequenceTimer.value = window.setTimeout(() => {
        target.classList.remove('message-row--focused')
        focusedSequenceTimer.value = null
    }, 2200)
    return true
}

const syncActiveConversation = async () => {
    const conversationId = chatStore.activeConversationId
    if (!conversationId) {
        return
    }
    try {
        if (chatStore.activeConversation?.type === 'group') {
            await chatStore.loadMembers(conversationId)
        }
        if (!chatStore.focusedSequenceMap[conversationId]) {
            await scrollToBottom()
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载会话失败'))
    }
}

const handleSendMessage = async () => {
    try {
        await chatStore.sendTextMessage(draftMessage.value)
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '发送消息失败'))
    } finally {
        draftMessage.value = ''
        chatStore.sendTyping(false)
    }
}

const handleDraftInput = () => {
    chatStore.sendTyping(Boolean(draftMessage.value.trim()))
    stopTypingSoon()
}

const handleComposerKeydown = (event: KeyboardEvent) => {
    if (settingsStore.chatSendHotkey === 'enter') {
        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            void handleSendMessage()
        }
        return
    }
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        void handleSendMessage()
    }
}

const stopTypingSoon = () => {
    if (typingStopTimer.value) {
        window.clearTimeout(typingStopTimer.value)
    }
    typingStopTimer.value = window.setTimeout(() => {
        chatStore.sendTyping(false)
    }, 1200)
}

const handleLoadOlderMessages = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    const container = messageContainerRef.value
    const previousHeight = container?.scrollHeight || 0
    const previousTop = container?.scrollTop || 0
    try {
        await chatStore.loadOlderMessages(chatStore.activeConversationId)
        await nextTick()
        if (container) {
            container.scrollTop = container.scrollHeight - previousHeight + previousTop
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载历史消息失败'))
    }
}

const handleLeaveConversation = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.leaveConversation(chatStore.activeConversationId)
        groupDrawerOpen.value = false
        message.success('已退出群聊')
        await router.replace({ name: 'ChatMessages' })
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '退出群聊失败'))
    }
}

const handleAddFriend = async () => {
    if (!directTargetUser.value) {
        return
    }
    try {
        await chatStore.submitFriendRequest(directTargetUser.value.id)
        message.success('好友申请已发送')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '发送好友申请失败'))
    }
}

const openSettingsDrawer = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    groupDrawerOpen.value = true
    try {
        if (chatStore.activeConversation?.type === 'group') {
            await Promise.all([
                chatStore.loadMembers(chatStore.activeConversationId),
                chatStore.loadJoinRequests(chatStore.activeConversationId),
                chatStore.loadFriends(),
            ])
        } else {
            await chatStore.loadFriends()
        }
        syncGroupConfigForm()
        syncPreferenceForm()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载会话设置失败'))
    }
}

const handleGroupAvatarUpload: UploadProps['beforeUpload'] = async (file) => {
    const warning = validateAvatarFile(file as File)
    if (warning) {
        message.warning(warning)
        return false
    }

    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }

    avatarTempObjectUrl = URL.createObjectURL(file as File)
    avatarCropImageUrl.value = avatarTempObjectUrl
    avatarCropOpen.value = true
    return false
}

const handleAvatarCropCancel = () => {
    clearCropState()
}

const handleAvatarCropConfirm = async (avatarFile: File) => {
    if (!chatStore.activeConversationId) {
        clearCropState()
        return
    }
    if (!authStore.accessToken) {
        message.error('登录状态无效，无法上传头像')
        return
    }

    groupAvatarUploading.value = true
    try {
        const result = await uploadFileWithCategory({
            file: avatarFile,
            category: 'profile',
            token: authStore.accessToken,
        })
        groupConfigForm.avatar = result.url
        await chatStore.updateGroupConfig(chatStore.activeConversationId, { avatar: result.url })
        message.success('群头像已更新')
        clearCropState()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '上传群头像失败'))
    } finally {
        groupAvatarUploading.value = false
    }
}

const handleSaveGroupConfig = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    if (!trimText(groupConfigForm.name)) {
        message.warning('请输入群名称')
        return
    }
    groupConfigSaving.value = true
    try {
        await chatStore.updateGroupConfig(chatStore.activeConversationId, {
            name: trimText(groupConfigForm.name),
            avatar: trimText(groupConfigForm.avatar),
            join_approval_required: groupConfigForm.join_approval_required,
            allow_member_invite: groupConfigForm.allow_member_invite,
            mute_all: groupConfigForm.mute_all,
            max_members: groupConfigForm.max_members,
        })
        syncGroupConfigForm()
        groupNameEditing.value = false
        message.success('群聊设置已更新')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '更新群聊设置失败'))
    } finally {
        groupConfigSaving.value = false
    }
}

const toggleGroupNameEditing = async () => {
    if (groupNameEditing.value) {
        groupConfigForm.name = chatStore.activeConversation?.name || ''
        groupNameEditing.value = false
        return
    }
    groupConfigForm.name = chatStore.activeConversation?.name || groupConfigForm.name
    groupNameEditing.value = true
    await focusEditableInput(groupNameInputRef.value)
}

const updateGroupConfigPartial = async (payload: { name?: string; max_members?: number | null; join_approval_required?: boolean; allow_member_invite?: boolean; mute_all?: boolean }) => {
    if (!chatStore.activeConversationId) {
        return
    }
    groupConfigSaving.value = true
    try {
        await chatStore.updateGroupConfig(chatStore.activeConversationId, payload)
    } catch (error: unknown) {
        syncGroupConfigForm()
        message.error(getErrorMessage(error, '更新群聊设置失败'))
    } finally {
        groupConfigSaving.value = false
    }
}

const commitGroupName = async () => {
    const nextValue = trimText(groupConfigForm.name)
    groupNameEditing.value = false
    if (!chatStore.activeConversationId || !nextValue || nextValue === (chatStore.activeConversation?.name || '')) {
        groupConfigForm.name = nextValue || chatStore.activeConversation?.name || ''
        return
    }
    groupConfigForm.name = nextValue
    await updateGroupConfigPartial({ name: nextValue })
}

const handleGroupNameBlur = async () => {
    if (skipNextGroupNameBlur.value) {
        skipNextGroupNameBlur.value = false
        return
    }
    await commitGroupName()
}

const handleGroupNameEnter = async (event: KeyboardEvent) => {
    event.preventDefault()
    skipNextGroupNameBlur.value = true
    ;(event.target as HTMLInputElement | null)?.blur()
    await commitGroupName()
}

const handleGroupNameEscape = () => {
    groupConfigForm.name = chatStore.activeConversation?.name || ''
    groupNameEditing.value = false
}

const handleGroupMaxMembersBlur = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    const currentValue = chatStore.activeConversation?.group_config?.max_members ?? null
    if ((groupConfigForm.max_members ?? null) === currentValue) {
        return
    }
    await updateGroupConfigPartial({ max_members: groupConfigForm.max_members ?? null })
}

const handleGroupSwitchChange = async (field: 'join_approval_required' | 'allow_member_invite' | 'mute_all', checked: boolean) => {
    await updateGroupConfigPartial({ [field]: checked })
}

const handlePinChange = async (checked: boolean) => {
    if (!chatStore.activeConversationId) {
        return
    }
    const previous = pinnedConversation.value
    pinnedConversation.value = checked
    try {
        await chatStore.toggleConversationPin(chatStore.activeConversationId, checked)
    } catch (error: unknown) {
        pinnedConversation.value = previous
        message.error(getErrorMessage(error, '更新置顶状态失败'))
    }
}

const handleMuteNotificationChange = async (checked: boolean) => {
    if (!chatStore.activeConversationId) {
        return
    }
    const previous = muteNotifications.value
    muteNotifications.value = checked
    try {
        await chatStore.updateConversationPreferences(chatStore.activeConversationId, { mute_notifications: checked })
    } catch (error: unknown) {
        muteNotifications.value = previous
        message.error(getErrorMessage(error, '更新免打扰状态失败'))
    }
}

const handleSaveGroupNickname = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    if (groupNicknameSaving.value) {
        return
    }
    groupNicknameSaving.value = true
    try {
        const nextValue = trimText(groupNicknameInput.value)
        await chatStore.updateConversationPreferences(chatStore.activeConversationId, { group_nickname: nextValue })
        groupNicknameInput.value = nextValue
        message.success('群昵称已更新')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '更新群昵称失败'))
    } finally {
        groupNicknameSaving.value = false
    }
}

const commitGroupNickname = async () => {
    const nextValue = trimText(groupNicknameInput.value)
    const currentValue = chatStore.activeConversation?.member_settings?.group_nickname || ''
    groupNicknameInput.value = nextValue
    if (nextValue === currentValue) {
        return
    }
    await handleSaveGroupNickname()
}

const handleGroupNicknameBlur = async () => {
    if (skipNextGroupNicknameBlur.value) {
        skipNextGroupNicknameBlur.value = false
        return
    }
    await commitGroupNickname()
}

const handleGroupNicknameEnter = async (event: KeyboardEvent) => {
    event.preventDefault()
    skipNextGroupNicknameBlur.value = true
    ;(event.target as HTMLInputElement | null)?.blur()
    await commitGroupNickname()
}

const handleSaveDirectRemark = async () => {
    if (!currentFriendship.value) {
        return
    }
    if (friendRemarkSaving.value) {
        return
    }
    friendRemarkSaving.value = true
    try {
        const nextValue = trimText(directRemark.value)
        await chatStore.updateFriendRemark(currentFriendship.value.friend_user.id, nextValue)
        directRemark.value = nextValue
        message.success('好友备注已更新')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '更新好友备注失败'))
    } finally {
        friendRemarkSaving.value = false
    }
}

const toggleDirectRemarkEditing = async () => {
    if (directRemarkEditing.value) {
        directRemark.value = currentFriendship.value?.remark || ''
        directRemarkEditing.value = false
        return
    }
    directRemark.value = currentFriendship.value?.remark || ''
    directRemarkEditing.value = true
    await focusEditableInput(directRemarkInputRef.value)
}

const commitDirectRemark = async () => {
    const nextValue = trimText(directRemark.value)
    const currentValue = currentFriendship.value?.remark || ''
    directRemarkEditing.value = false
    directRemark.value = nextValue
    if (nextValue === currentValue) {
        return
    }
    await handleSaveDirectRemark()
}

const handleDirectRemarkBlur = async () => {
    if (skipNextDirectRemarkBlur.value) {
        skipNextDirectRemarkBlur.value = false
        return
    }
    await commitDirectRemark()
}

const handleDirectRemarkEnter = async (event: KeyboardEvent) => {
    event.preventDefault()
    skipNextDirectRemarkBlur.value = true
    ;(event.target as HTMLInputElement | null)?.blur()
    await commitDirectRemark()
}

const handleDirectRemarkEscape = () => {
    directRemark.value = currentFriendship.value?.remark || ''
    directRemarkEditing.value = false
}

const handleInviteMember = async () => {
    if (!chatStore.activeConversationId || !inviteUserId.value) {
        return
    }
    try {
        await chatStore.inviteMember(chatStore.activeConversationId, inviteUserId.value)
        inviteUserId.value = null
        message.success('邀请已提交')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '添加成员失败'))
    }
}

const handleRemoveMember = async (userId: number) => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.removeMember(chatStore.activeConversationId, userId)
        message.success('成员已移除')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '移除成员失败'))
    }
}

const handleToggleMemberRole = async (userId: number, role: 'admin' | 'member') => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.updateMemberRole(chatStore.activeConversationId, userId, role)
        message.success('成员角色已更新')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '更新成员角色失败'))
    }
}

const handleMuteMember = async (userId: number) => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.muteMember(chatStore.activeConversationId, userId, 10, '前端快捷禁言')
        message.success('已禁言 10 分钟')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '禁言成员失败'))
    }
}

const handleJoinRequestAction = async (requestId: number, action: 'approve' | 'reject') => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.handleJoinRequest(requestId, action, chatStore.activeConversationId)
        message.success('审批已处理')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '处理审批失败'))
    }
}

const openFailedMenu = (event: MouseEvent, messageItem: ChatMessageItem) => {
    failedMenuPosition.value = { x: event.clientX, y: event.clientY }
    failedMenuMessage.value = messageItem
    failedMenuOpen.value = true
}

const handleRetryMessage = async () => {
    if (!failedMenuMessage.value) {
        return
    }
    try {
        await chatStore.retryMessage(failedMenuMessage.value)
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '重新发送失败'))
    } finally {
        closeFailedMenu()
    }
}

watch(
    () => chatStore.activeConversationId,
    () => {
        void syncActiveConversation()
    },
    { immediate: true },
)

watch(
    () => chatStore.activeMessages.length,
    async () => {
        const activeId = chatStore.activeConversationId
        const focusSequence = activeId ? chatStore.focusedSequenceMap[activeId] : null
        if (activeId && focusSequence) {
            const located = await scrollToSequence(focusSequence)
            if (located) {
                chatStore.clearFocusedSequence(activeId)
                return
            }
        }
        await scrollToBottom()
    },
)

watch(
    () => chatStore.activeConversation?.group_config,
    () => {
        syncGroupConfigForm()
    },
    { immediate: true },
)

watch(
    () => [chatStore.activeConversation, currentFriendship.value],
    () => {
        syncPreferenceForm()
    },
    { immediate: true },
)

onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
    if (typingStopTimer.value) {
        window.clearTimeout(typingStopTimer.value)
    }
    if (focusedSequenceTimer.value) {
        window.clearTimeout(focusedSequenceTimer.value)
    }
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }
})
</script>

<style scoped>
.chat-main {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    min-width: 0;
    height: 100%;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: var(--chat-panel-shadow);
}

.chat-main__header,
.chat-main__history-toolbar,
.chat-main__composer {
    padding: 16px 20px;
}

.chat-main__header,
.chat-main__composer-actions,
.message-bubble__meta,
.drawer-toolbar,
.drawer-list-item,
.chat-main__meta,
.group-settings-card__header,
.direct-profile-card__main,
.nickname-editor,
.member-item__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.chat-main__header {
    border-bottom: 1px solid var(--chat-panel-border);
}

.chat-main__title {
    font-size: 22px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-main__meta,
.message-bubble__meta,
.system-bubble,
.drawer-list-desc {
    color: var(--chat-text-secondary);
}

.chat-main__meta {
    margin-top: 6px;
    font-size: 12px;
}

.chat-menu-trigger {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 10px;
}

.chat-main__history-toolbar {
    padding-top: 12px;
    padding-bottom: 0;
}

.chat-main__messages,
.drawer-list {
    overflow: auto;
}

.chat-main__messages {
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--chat-subtle-bg) 90%, transparent), var(--chat-panel-bg-strong));
}

.message-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 14px;
    transition: transform 0.2s ease, filter 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.message-row.self {
    justify-content: flex-end;
}

.message-row.system {
    justify-content: center;
}

.message-bubble-wrap {
    display: flex;
    flex-direction: column;
    width: fit-content;
    max-width: 80%;
}

.message-bubble-wrap.self {
    align-items: flex-end;
}

.message-bubble-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
}

.message-bubble-row.self {
    justify-content: flex-end;
}

.message-row--focused {
    background: color-mix(in srgb, var(--chat-accent-soft) 82%, var(--chat-panel-bg));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chat-accent) 22%, transparent), 0 10px 24px color-mix(in srgb, var(--chat-accent) 10%, transparent);
}

.message-bubble__meta {
    margin-bottom: 6px;
    font-size: 12px;
}

.message-bubble {
    display: inline-block;
    width: fit-content;
    max-width: 100%;
    padding: 12px 14px;
    border-radius: 18px 18px 18px 6px;
    background: var(--chat-message-bg);
    color: var(--chat-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
}

.message-bubble.self {
    border-radius: 18px 18px 6px 18px;
    background: var(--chat-message-self-bg);
    color: var(--chat-message-self-text);
}

.message-status {
    display: flex;
    justify-content: flex-start;
}

.message-status--inline {
    align-self: flex-end;
    margin-bottom: 4px;
}

.message-status__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, var(--chat-accent) 24%, transparent);
    border-top-color: var(--chat-accent);
    border-radius: 999px;
    animation: chat-spin 0.8s linear infinite;
}

.message-status__failed {
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    cursor: pointer;
}

.system-bubble {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--chat-system-bg);
    font-size: 12px;
}

.chat-main__composer {
    border-top: 1px solid var(--chat-panel-border);
    background: color-mix(in srgb, var(--chat-panel-bg-strong) 76%, transparent);
}

.chat-main__composer-actions {
    justify-content: flex-end;
    margin-top: 10px;
}

.drawer-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.settings-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 16px;
    padding: 16px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--chat-panel-bg-strong) 94%, transparent), var(--chat-subtle-bg));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chat-panel-border) 72%, transparent);
}

.settings-section__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.settings-section__desc,
.settings-section__link,
.member-preview__meta {
    color: var(--chat-text-secondary);
    font-size: 12px;
}

.settings-section__header-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.settings-section__link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.settings-section__header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.settings-section__link-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--chat-text-secondary);
    cursor: pointer;
}

.group-basic-panel {
    display: flex;
    gap: 18px;
}

.group-basic-panel__fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.group-summary-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 14px;
    background: var(--chat-panel-bg-strong);
}

.group-summary-card__avatar {
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
}

.group-summary-card__body {
    flex: 1;
    min-width: 0;
}

.group-summary-card__top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.group-summary-card__name {
    min-width: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--chat-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.group-summary-card__meta {
    margin-top: 4px;
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.group-summary-card__edit {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 8px;
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
    cursor: pointer;
}

.group-summary-card__input {
    max-width: 240px;
}

.group-summary-card__input--editing,
.friend-remark-editor__input {
    animation: chat-field-focus-in 0.18s ease;
}

.group-switch-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.group-config-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--chat-text-secondary);
}

.group-config-field--inline {
    align-items: center;
}

.drawer-toolbar {
    margin-bottom: 14px;
}

.drawer-list-item {
    padding: 12px 14px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
}

.drawer-list-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.request-item,
.member-item {
    align-items: flex-start;
}

.member-item__main {
    justify-content: flex-start;
    min-width: 0;
}

.member-preview-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
}

.member-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 48px;
    padding: 0;
    border: 0;
    background: transparent;
}

.member-preview--add {
    width: 42px;
    height: 42px;
    border: 1px dashed color-mix(in srgb, var(--chat-accent) 34%, transparent);
    border-radius: 999px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--chat-accent-soft) 92%, transparent), color-mix(in srgb, var(--chat-panel-bg-strong) 92%, transparent));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chat-accent) 10%, transparent);
    cursor: pointer;
}

.member-preview__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: transparent;
    color: var(--chat-accent);
}

.setting-switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--chat-text-primary);
}

.nickname-editor {
    justify-content: flex-start;
    gap: 10px;
    flex-wrap: wrap;
}

.nickname-editor :deep(.ant-input) {
    flex: 1;
    min-width: 180px;
}

.nickname-editor__label,
.nickname-editor__preview {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.friend-remark-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.friend-remark-editor__top {
    display: flex;
    align-items: center;
    gap: 8px;
}

.friend-remark-editor__top :deep(.ant-input) {
    flex: 1;
}

.friend-remark-editor__value {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--chat-text-primary);
}

@keyframes chat-field-focus-in {
    from {
        opacity: 0;
        transform: translateY(2px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.direct-profile-card {
    gap: 18px;
}

.group-leave-btn {
    margin-top: 16px;
}

.failed-menu {
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
    padding: 6px;
    background: var(--chat-panel-bg-strong);
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    box-shadow: var(--chat-panel-shadow);
}

.failed-menu__item {
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--chat-text-primary);
    text-align: left;
    cursor: pointer;
}

.failed-menu__item:hover {
    background: var(--chat-accent-soft);
}

@keyframes chat-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

@media (max-width: 960px) {
    .chat-main {
        min-height: 70vh;
    }

    .message-bubble-wrap {
        max-width: 88%;
    }

    .group-basic-panel {
        flex-direction: column;
    }

    .member-preview-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}
</style>
