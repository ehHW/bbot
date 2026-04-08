<template>
    <main class="chat-main" :style="chatMainStyle">
        <template v-if="chatStore.activeConversation">
            <header class="chat-main__header">
                <div class="chat-main__header-main">
                    <div class="chat-main__title-row">
                        <div class="chat-main__title">{{ chatStore.activeConversation.name }}</div>
                        <div v-if="chatStore.activeConversation.type === 'group'" class="chat-main__meta-tag">{{ chatStore.activeConversation.member_count }} 人群聊</div>
                    </div>
                    <div v-if="typingText" class="chat-main__meta">{{ typingText }}</div>
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
                <div v-if="messageSelectionMode" class="chat-main__selection-bar">
                    <span>已选择 {{ selectedMessageIds.length }} 条消息</span>
                    <a-space>
                        <a-button size="small" @click="handleForwardSelection">转发</a-button>
                        <a-button size="small" @click="clearMessageSelection">取消多选</a-button>
                    </a-space>
                </div>
            </div>

            <div ref="messageContainerRef" class="chat-main__messages">
                <div
                    v-for="messageItem in chatStore.activeMessages"
                    :key="messageItem.id"
                    class="message-row"
                    :class="[messageRowClass(messageItem), { 'message-row--selection-mode': messageSelectionMode }]"
                    :data-sequence="messageItem.sequence"
                    @click.capture="handleMessageRowClick(messageItem, $event)"
                >
                    <template v-if="messageItem.is_system">
                        <div class="system-bubble">{{ messageItem.content }}</div>
                    </template>
                    <template v-else>
                        <div class="message-row__content" :class="{ self: isSelfMessage(messageItem) }">
                            <a-avatar v-if="!isSelfMessage(messageItem)" class="message-row__avatar" :src="messageItem.sender?.avatar || undefined">
                                {{ avatarText(messageItem.sender?.display_name || messageItem.sender?.username || '?') }}
                            </a-avatar>
                            <div class="message-bubble-wrap" :class="{ self: isSelfMessage(messageItem) }">
                                <div v-if="showGroupSenderLine(messageItem)" class="message-bubble__sender-line" :class="{ self: isSelfMessage(messageItem) }">
                                    <span class="message-bubble__sender">{{ getSenderLabel(messageItem) }}</span>
                                </div>
                                <div class="message-bubble-row" :class="{ self: isSelfMessage(messageItem) }">
                                    <span v-if="isSelfMessage(messageItem)" class="message-bubble__time self">{{ formatTime(messageItem.created_at) }}</span>
                                    <div v-if="isSelfMessage(messageItem) && messageItem.local_status" class="message-status message-status--inline">
                                        <span v-if="messageItem.local_status === 'sending'" class="message-status__spinner" aria-label="发送中"></span>
                                        <button v-else type="button" class="message-status__failed" @click.stop="openMessageMenu($event, messageItem)">!</button>
                                    </div>
                                    <div class="message-bubble" :class="{ self: isSelfMessage(messageItem), 'message-bubble--interactive': hasMessageBubbleAction(messageItem) }" @click="handleMessageBubbleClick(messageItem)" @contextmenu.prevent.stop="openMessageMenu($event, messageItem)">
                                        <div v-if="getForwardedPayload(messageItem)" class="message-bubble__forwarded">
                                            转发自 {{ getForwardedPayload(messageItem)?.sender_name }}
                                        </div>
                                        <button
                                            v-if="getReplyPayload(messageItem)"
                                            type="button"
                                            class="message-bubble__reply"
                                            @click.stop="handleReplyJump(getReplyPayload(messageItem)!)"
                                        >
                                            <span class="message-bubble__reply-arrow"><ArrowUpOutlined /></span>
                                            <div class="message-bubble__reply-body">
                                                <div class="message-bubble__reply-sender">{{ getReplyPayload(messageItem)?.sender_name }}</div>
                                                <div class="message-bubble__reply-content">"{{ getReplyPayload(messageItem)?.content_preview }}"</div>
                                            </div>
                                        </button>
                                        <template v-if="getGroupInvitationPayload(messageItem)">
                                            <button
                                                type="button"
                                                class="group-invitation-card"
                                                :class="{ self: isSelfMessage(messageItem) }"
                                                @click.stop="openGroupInvitationModal(messageItem)"
                                            >
                                                <div class="group-invitation-card__header">群聊邀请</div>
                                                <div class="group-invitation-card__main">
                                                    <a-avatar :src="getGroupInvitationPayload(messageItem)?.group_avatar || undefined" :size="44">
                                                        {{ avatarText(getGroupInvitationPayload(messageItem)?.group_name || '群') }}
                                                    </a-avatar>
                                                    <div class="group-invitation-card__body">
                                                        <div class="group-invitation-card__name">{{ getGroupInvitationPayload(messageItem)?.group_name }}</div>
                                                        <div class="group-invitation-card__meta">
                                                            {{ getGroupInvitationPayload(messageItem)?.member_count || 0 }} 人
                                                            <span>·</span>
                                                            {{ getGroupInvitationPayload(messageItem)?.join_approval_required ? '申请后需审批' : '可直接加入' }}
                                                        </div>
                                                        <div class="group-invitation-card__desc">{{ getGroupInvitationPayload(messageItem)?.inviter.display_name || getGroupInvitationPayload(messageItem)?.inviter.username }} 邀请你加入群聊</div>
                                                    </div>
                                                </div>
                                                <div class="group-invitation-card__footer">
                                                    <span v-if="isSelfMessage(messageItem)">已发送邀请消息</span>
                                                    <span v-else>点击查看并申请加入</span>
                                                </div>
                                            </button>
                                        </template>
                                        <template v-else-if="isAssetMessage(messageItem)">
                                            <div class="attachment-bubble" :class="{ self: isSelfMessage(messageItem) }">
                                                <img v-if="canPreviewImage(messageItem)" :src="getAssetMessagePayload(messageItem)?.url" :alt="getAssetDisplayName(messageItem)" class="attachment-bubble__preview" />
                                                <div v-else class="attachment-file-card">
                                                    <span class="attachment-file-card__icon">
                                                        <FileOutlined />
                                                    </span>
                                                    <div class="attachment-file-card__body">
                                                        <span class="attachment-file-card__name">{{ getAssetDisplayName(messageItem) }}</span>
                                                        <span class="attachment-file-card__size">{{ formatAssetFileSize(messageItem) }}</span>
                                                    </div>
                                                </div>
                                                <div v-if="canPreviewImage(messageItem)" class="attachment-bubble__body">
                                                    <span class="attachment-bubble__name">{{ getAssetDisplayName(messageItem) }}</span>
                                                    <span class="attachment-bubble__size">{{ formatAssetFileSize(messageItem) }}</span>
                                                </div>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <div class="message-bubble__text">{{ messageItem.content }}</div>
                                        </template>
                                    </div>
                                    <span v-if="!isSelfMessage(messageItem)" class="message-bubble__time">{{ formatTime(messageItem.created_at) }}</span>
                                </div>
                            </div>
                            <a-avatar v-if="isSelfMessage(messageItem)" class="message-row__avatar message-row__avatar--self" :src="messageItem.sender?.avatar || undefined">
                                {{ avatarText(messageItem.sender?.display_name || messageItem.sender?.username || '?') }}
                            </a-avatar>
                        </div>
                        <button
                            v-if="messageSelectionMode"
                            type="button"
                            class="message-row__select"
                            :class="{ 'is-checked': isMessageSelected(messageItem.id) }"
                            tabindex="-1"
                            aria-hidden="true"
                        >
                            <span class="message-row__select-indicator"></span>
                        </button>
                    </template>
                </div>
            </div>

            <div class="chat-main__composer-resizer" @mousedown="startComposerResize"></div>

            <footer class="chat-main__composer">
                <div class="chat-main__composer-toolbar">
                    <a-dropdown placement="topLeft" :trigger="['click']">
                        <a-tooltip title="附件与资源中心">
                            <a-button class="chat-main__composer-trigger" :disabled="composerDisabled || attachmentUploading">
                                <PaperClipOutlined />
                            </a-button>
                        </a-tooltip>
                        <template #overlay>
                            <a-menu @click="handleComposerMenuClick">
                                <a-menu-item key="attachment">本地附件</a-menu-item>
                                <a-menu-item key="asset-picker">资源中心</a-menu-item>
                            </a-menu>
                        </template>
                    </a-dropdown>
                </div>
                <div v-if="quotedMessage" class="chat-main__quote-bar">
                    <div>
                        <div class="chat-main__quote-title">引用回复</div>
                        <div class="chat-main__quote-content">{{ getMessageQuotePreview(quotedMessage) }}</div>
                    </div>
                    <button type="button" class="chat-main__quote-close" @click="quotedMessage = null">关闭</button>
                </div>
                <RichMessageComposer
                    ref="composerRef"
                    :disabled="composerDisabled"
                    class="chat-main__composer-input"
                    :placeholder="composerPlaceholder"
                    :send-hotkey="settingsStore.chatSendHotkey"
                    @typing-change="handleComposerTypingChange"
                    @request-submit="handleSendMessage"
                />
                <div class="chat-main__composer-actions">
                    <input ref="attachmentInputRef" type="file" class="chat-main__attachment-input" multiple @change="handleAttachmentSelection" />
                    <a-button type="primary" :disabled="composerDisabled" @click="handleSendMessage">发送</a-button>
                </div>
            </footer>
        </template>

        <a-empty v-else description="选择一个会话开始聊天" />

        <transition name="message-menu-fade">
            <div v-if="messageMenuOpen && messageMenuMessage" class="failed-menu" :style="messageMenuStyle">
                <button type="button" class="failed-menu__item" @click="handleCopyMessage">复制</button>
                <button type="button" class="failed-menu__item" @click="handleForwardMessage">转发</button>
                <button type="button" class="failed-menu__item" @click="handleQuoteMessage">引用</button>
                <button type="button" class="failed-menu__item" @click="enableMessageSelection(messageMenuMessage)">多选</button>
                <button v-if="messageMenuMessage.local_status === 'failed'" type="button" class="failed-menu__item" @click="handleRetryMessage">重新发送</button>
            </div>
        </transition>

        <a-modal v-model:open="forwardModalOpen" title="选择聊天" :footer="null" :width="CHAT_MODAL_WIDTH_LG">
            <div class="forward-modal">
                <div class="forward-modal__topbar">
                    <div class="forward-modal__summary">选择一个聊天目标后会继续弹出确认框</div>
                    <a-input v-model:value="forwardSearchKeyword" allow-clear placeholder="搜索会话 / 好友 / 群组" class="forward-modal__search" />
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
                            @click="handleSelectForwardTarget(target)"
                        >
                            <a-avatar :src="target.avatar || undefined" :size="44">{{ avatarText(target.name) }}</a-avatar>
                            <span class="forward-modal__recent-name">{{ target.name }}</span>
                            <span class="forward-modal__recent-desc">{{ target.targetType === 'friend' ? '好友' : target.description || '会话' }}</span>
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
                            @click="handleSelectForwardTarget(target)"
                        >
                            <a-avatar :src="target.avatar || undefined" :size="44">{{ avatarText(target.name) }}</a-avatar>
                            <div class="forward-modal__body">
                                <span class="forward-modal__name">{{ target.name }}</span>
                                <span class="forward-modal__desc">{{ target.description || (target.targetType === 'friend' ? '好友' : '暂无消息') }}</span>
                            </div>
                            <span class="forward-modal__type">{{ target.targetType === 'friend' ? '好友' : '聊天' }}</span>
                        </button>
                        <a-empty v-if="!filteredForwardTargets.length" description="没有匹配的聊天目标" />
                    </div>
                </div>
            </div>
        </a-modal>

        <a-modal v-model:open="groupInvitationModalOpen" title="群聊邀请" :footer="null" :width="CHAT_MODAL_WIDTH_LG">
            <div v-if="activeGroupInvitation" class="group-invitation-modal">
                <div class="group-invitation-modal__summary">
                    <a-avatar :src="activeGroupInvitation.group_avatar || undefined" :size="64">
                        {{ avatarText(activeGroupInvitation.group_name || '群') }}
                    </a-avatar>
                    <div class="group-invitation-modal__body">
                        <div class="group-invitation-modal__name">{{ activeGroupInvitation.group_name }}</div>
                        <div class="group-invitation-modal__meta">{{ activeGroupInvitation.member_count }} 人群聊</div>
                        <div class="group-invitation-modal__desc">邀请人：{{ activeGroupInvitation.inviter.display_name || activeGroupInvitation.inviter.username }}</div>
                        <div class="group-invitation-modal__desc">{{ activeGroupInvitation.join_approval_required ? '提交后需要管理员审批。' : '提交后可直接加入该群聊。' }}</div>
                    </div>
                </div>
                <div class="group-invitation-modal__actions">
                    <a-button @click="groupInvitationModalOpen = false">关闭</a-button>
                    <a-button
                        v-if="activeGroupInvitation.inviter.id !== userStore.user?.id"
                        type="primary"
                        :loading="groupInvitationApplying"
                        @click="handleApplyGroupInvitation"
                    >
                        申请加入群聊
                    </a-button>
                </div>
            </div>
        </a-modal>

        <a-drawer v-model:open="groupDrawerOpen" :title="settingsDrawerTitle" :width="CHAT_DRAWER_WIDTH" :body-style="drawerBodyStyle">
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
                        <button type="button" class="settings-section__link-button" @click="openMemberModal()">
                            <span>{{ chatStore.activeMembers.length }} 人</span>
                            <span class="settings-section__link"><RightOutlined /></span>
                        </button>
                    </div>
                    <div class="member-preview-grid">
                        <div v-for="member in previewMembers" :key="member.user.id" class="member-preview">
                            <a-avatar :src="member.user.avatar || undefined" :size="42">{{ avatarText(memberDisplayName(member)) }}</a-avatar>
                        </div>
                        <button v-if="availableInviteFriends.length" type="button" class="member-preview member-preview--add" @click="openInviteModal()">
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

                <section class="settings-section settings-section--danger">
                    <a-button danger block class="group-leave-btn" @click="handleLeaveConversation">退出群聊</a-button>
                </section>
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

        <a-modal v-model:open="memberModalOpen" title="群成员" :footer="null" :width="CHAT_MEMBER_MODAL_WIDTH" :body-style="tallModalBodyStyle">
            <template v-if="chatStore.activeConversation?.type === 'group'">
                <div class="entity-modal__search">
                    <a-input v-model:value="memberSearchKeyword" allow-clear placeholder="搜索群成员" />
                </div>

                <div class="drawer-list entity-modal__list">
                    <div v-for="member in filteredGroupMembers" :key="member.user.id" class="drawer-list-item member-item">
                        <div class="member-item__main">
                            <a-avatar :src="member.user.avatar || undefined">{{ avatarText(memberDisplayName(member)) }}</a-avatar>
                            <div>
                                <div class="drawer-list-title">{{ memberDisplayName(member) }}<span v-if="member.friend_remark">（{{ member.friend_remark }}）</span></div>
                                <div class="drawer-list-desc">
                                    <span>{{ member.user.username }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="member-item__mute">
                            <span v-if="isMuteActive(member)">禁言至 {{ formatDateTime(member.mute_until!) }}</span>
                        </div>
                        <div class="member-item__actions">
                            <a-tag>{{ memberRoleLabel(member.role) }}</a-tag>
                            <a-dropdown v-if="showMemberActionMenu(member)" placement="bottomRight" :trigger="['hover']">
                                <a-button size="small" class="member-item__menu-trigger">
                                    <EllipsisOutlined />
                                </a-button>
                                <template #overlay>
                                    <a-menu @click="handleMemberActionMenuClick(member, $event)">
                                        <a-sub-menu v-if="canManageMembers && member.role !== 'owner'" key="mute">
                                            <template #title>设置禁言时长</template>
                                            <a-menu-item v-for="option in muteDurationOptions" :key="`mute:${option.minutes}`">{{ option.label }}</a-menu-item>
                                        </a-sub-menu>
                                        <a-menu-item v-if="canManageMembers && member.role !== 'owner' && isMuteActive(member)" key="unmute">解除禁言</a-menu-item>
                                        <a-menu-item v-if="canEditRoles && member.role !== 'owner'" key="toggle-role">{{ member.role === 'admin' ? '设为成员' : '设为管理员' }}</a-menu-item>
                                        <a-menu-item v-if="canManageMembers && member.role !== 'owner'" key="remove" danger>移除成员</a-menu-item>
                                    </a-menu>
                                </template>
                            </a-dropdown>
                        </div>
                    </div>
                    <a-empty v-if="!filteredGroupMembers.length" description="暂无匹配成员" />
                </div>
            </template>
        </a-modal>

        <a-modal v-model:open="inviteModalOpen" title="邀请好友进群" :footer="null" :width="CHAT_MODAL_WIDTH_LG" :body-style="tallModalBodyStyle">
            <template v-if="chatStore.activeConversation?.type === 'group'">
                <div class="entity-modal">
                    <div class="entity-modal__search">
                        <a-input v-model:value="inviteSearchKeyword" allow-clear placeholder="搜索好友昵称、备注或用户名" />
                    </div>
                    <div class="drawer-list entity-modal__list">
                        <label v-for="friend in filteredAvailableInviteFriends" :key="friend.friend_user.id" class="drawer-list-item invite-item">
                            <span class="invite-item__check">
                                <a-checkbox :checked="selectedInviteUserIds.includes(friend.friend_user.id)" @change="toggleInviteUser(friend.friend_user.id)" />
                            </span>
                            <div class="invite-item__main">
                                <a-avatar :src="friend.friend_user.avatar || undefined">{{ avatarText(friend.remark || friend.friend_user.display_name || friend.friend_user.username) }}</a-avatar>
                                <div>
                                    <div class="drawer-list-title">{{ friend.remark || friend.friend_user.display_name || friend.friend_user.username }}</div>
                                    <div class="drawer-list-desc">{{ friend.friend_user.display_name || friend.friend_user.username }} · {{ friend.friend_user.username }}</div>
                                </div>
                            </div>
                        </label>
                        <a-empty v-if="!filteredAvailableInviteFriends.length" description="暂无可邀请好友" />
                    </div>
                    <div class="entity-modal__footer">
                        <span class="entity-modal__selection">已选择 {{ selectedInviteUserIds.length }} 位好友</span>
                        <a-button type="primary" :disabled="!selectedInviteUserIds.length" @click="handleInviteMembers">邀请进群</a-button>
                    </div>
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
        <AssetPickerDialog v-model:open="assetPickerOpen" @select="handleAssetPickerSelect" />
    </main>
</template>

<script setup lang="ts">
import { ArrowUpOutlined, EditOutlined, EllipsisOutlined, FileOutlined, MenuOutlined, PaperClipOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { applyGroupInvitationApi, forwardMessagesApi, openDirectConversationApi } from '@/api/chat'
import AvatarCropModal from '@/components/AvatarCropModal.vue'
import AssetPickerDialog from '@/components/assets/AssetPickerDialog.vue'
import RichMessageComposer from '@/views/Chat/components/RichMessageComposer.vue'
import type { RichMessageComposerExpose } from '@/views/Chat/components/RichMessageComposer.vue'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import type { FileEntryItem, SearchFileEntryItem } from '@/api/upload'
import type { ChatComposerAttachmentToken, ChatComposerSegment, ChatConversationItem, ChatConversationMemberItem, ChatFriendshipItem, ChatGroupInvitationPayload, ChatMessageAssetPayload, ChatMessageForwardedPayload, ChatMessageItem, ChatMessageReplyPayload } from '@/types/chat'
import { buildAttachmentSendPayloadFromEntry, buildAttachmentSendPayloadFromUploadResult } from '@/utils/chatAttachment'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { formatFileSize } from '@/utils/fileFormatter'
import { useChatShell } from '@/views/Chat/useChatShell'
import { getErrorMessage } from '@/utils/error'
import { formatTime } from '@/utils/timeFormatter'
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

const assetPickerOpen = ref(false)
const composerRef = ref<RichMessageComposerExpose | null>(null)
const groupDrawerOpen = ref(false)
const groupConfigSaving = ref(false)
const groupAvatarUploading = ref(false)
const groupNameEditing = ref(false)
const directRemarkEditing = ref(false)
const groupNameInputRef = ref<{ focus: (options?: { cursor?: 'start' | 'end' | 'all' }) => void } | null>(null)
const directRemarkInputRef = ref<{ focus: (options?: { cursor?: 'start' | 'end' | 'all' }) => void } | null>(null)
const attachmentInputRef = ref<HTMLInputElement | null>(null)
const skipNextGroupNameBlur = ref(false)
const skipNextGroupNicknameBlur = ref(false)
const skipNextDirectRemarkBlur = ref(false)
const friendRemarkSaving = ref(false)
const groupNicknameSaving = ref(false)
const attachmentUploading = ref(false)
const memberModalOpen = ref(false)
const inviteModalOpen = ref(false)
const selectedInviteUserIds = ref<number[]>([])
const memberSearchKeyword = ref('')
const inviteSearchKeyword = ref('')
const memberSearchTerm = ref('')
const inviteSearchTerm = ref('')
const messageContainerRef = ref<HTMLElement | null>(null)
const typingStopTimer = ref<number | null>(null)
const focusedSequenceTimer = ref<number | null>(null)
const messageMenuOpen = ref(false)
const messageMenuMessage = ref<ChatMessageItem | null>(null)
const messageMenuPosition = ref({ x: 0, y: 0 })
const muteNotifications = ref(false)
const pinnedConversation = ref(false)
const groupNicknameInput = ref('')
const directRemark = ref('')
const avatarCropOpen = ref(false)
const avatarCropImageUrl = ref('')
const messageSelectionMode = ref(false)
const selectedMessageIds = ref<number[]>([])
const quotedMessage = ref<ChatMessageItem | null>(null)
const composerResizeState = ref<{ startY: number; composerHeight: number } | null>(null)
const forwardModalOpen = ref(false)
const forwardSearchKeyword = ref('')
const selectedForwardTargetKey = ref('')
const forwarding = ref(false)
const forwardingMessageIds = ref<number[]>([])
const groupInvitationModalOpen = ref(false)
const activeInvitationMessage = ref<ChatMessageItem | null>(null)
const groupInvitationApplying = ref(false)
let avatarTempObjectUrl = ''
let memberSearchTimer: number | null = null
let inviteSearchTimer: number | null = null

const COMPOSER_MIN_HEIGHT = 176
const COMPOSER_MAX_HEIGHT = 320
const CHAT_MEMBER_MODAL_WIDTH = 540
const CHAT_MODAL_WIDTH_LG = 720
const CHAT_DRAWER_WIDTH = 428
const FORWARD_RECENT_STORAGE_KEY = 'solbot.chat.forward.recent-targets'
const FORWARD_RECENT_LIMIT = 7

const drawerBodyStyle = {
    padding: '16px',
}

const MESSAGE_MENU_WIDTH = 156
const MESSAGE_MENU_MIN_HEIGHT = 188
const MESSAGE_MENU_VIEWPORT_PADDING = 12

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

const availableInviteFriends = computed(() => {
    const currentMembers = new Set(chatStore.activeMembers.map((item) => item.user.id))
    return chatStore.friends.filter((item) => !currentMembers.has(item.friend_user.id))
})

type ForwardTargetOption = {
    key: string
    targetType: 'conversation' | 'friend'
    conversationId: number | null
    userId: number | null
    name: string
    avatar: string
    description: string
    searchText: string
    sortTime: string
}

const recentForwardTargetKeys = ref<string[]>([])

const previewMembers = computed(() => chatStore.activeMembers.slice(0, 8))
const currentConversationMember = computed(() => {
    const currentUserId = userStore.user?.id
    if (!currentUserId) {
        return null
    }
    return chatStore.activeMembers.find((member) => member.user.id === currentUserId) || null
})
const composerDisabled = computed(() => !chatStore.activeConversation?.can_send_message)
const composerBlockedReason = computed(() => {
    const conversation = chatStore.activeConversation
    if (!conversation || conversation.can_send_message) {
        return ''
    }
    if (conversation.type === 'group') {
        const selfMember = currentConversationMember.value
        if (selfMember?.mute_until && new Date(selfMember.mute_until).getTime() > Date.now()) {
            return `您已被禁言至 ${formatDateTime(selfMember.mute_until)}`
        }
        if (conversation.group_config?.mute_all && conversation.member_role !== 'owner') {
            return '全员禁言中...'
        }
    }
    return '当前会话暂不可发送消息'
})
const filteredGroupMembers = computed(() => {
    const keyword = memberSearchTerm.value.trim().toLowerCase()
    if (!keyword) {
        return chatStore.activeMembers
    }
    return chatStore.activeMembers.filter((member) => buildMemberSearchText(member).includes(keyword))
})
const filteredAvailableInviteFriends = computed(() => {
    const keyword = inviteSearchTerm.value.trim().toLowerCase()
    if (!keyword) {
        return availableInviteFriends.value
    }
    return availableInviteFriends.value.filter((friend) => buildFriendSearchText(friend).includes(keyword))
})

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

const isSelfDirectConversation = computed(() => {
    if (chatStore.activeConversation?.type !== 'direct') {
        return false
    }
    const currentUserId = userStore.user?.id
    if (!currentUserId) {
        return false
    }
    if (chatStore.activeConversation.direct_target?.id === currentUserId) {
        return true
    }
    return chatStore.activeConversation.member_count === 1
})

const isDirectFriend = computed(() => {
    if (!chatStore.activeConversation || chatStore.activeConversation.type !== 'direct') {
        return false
    }
    if (isSelfDirectConversation.value) {
        return true
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
const composerPlaceholder = computed(() => composerBlockedReason.value || `输入文本消息，按 ${sendShortcutLabel.value} 发送`)
const messageMenuStyle = computed(() => ({ left: `${messageMenuPosition.value.x}px`, top: `${messageMenuPosition.value.y}px` }))
const chatMainStyle = computed(() => ({ gridTemplateRows: `auto auto minmax(220px, 1fr) 8px ${settingsStore.chatLayout.composerHeight}px` }))
const muteDurationOptions = [
    { minutes: 10, label: '禁言 10 分钟' },
    { minutes: 30, label: '禁言 30 分钟' },
    { minutes: 60, label: '禁言 1 小时' },
    { minutes: 60 * 24, label: '禁言 1 天' },
    { minutes: 60 * 24 * 7, label: '禁言 7 天' },
]

const getAttachmentSendGuardMessage = () => {
    const activeConversation = chatStore.activeConversation
    if (composerBlockedReason.value) {
        return composerBlockedReason.value
    }
    if (activeConversation?.type === 'direct' && !isDirectFriend.value) {
        return '你们还不是好友，当前私聊暂不支持发送附件'
    }
    return ''
}

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

const isMuteActive = (member: ChatConversationMemberItem) => Boolean(member.mute_until && new Date(member.mute_until).getTime() > Date.now())

const showMemberActionMenu = (member: ChatConversationMemberItem) => {
    if (member.role === 'owner') {
        return false
    }
    return canManageMembers.value || canEditRoles.value
}

const buildMemberSearchText = (member: ChatConversationMemberItem) => {
    return `${member.group_nickname || ''} ${member.friend_remark || ''} ${member.user.display_name || ''} ${member.user.username || ''}`.toLowerCase()
}

const buildFriendSearchText = (friend: (typeof availableInviteFriends.value)[number]) => {
    return `${friend.remark || ''} ${friend.friend_user.display_name || ''} ${friend.friend_user.username || ''}`.toLowerCase()
}

const loadRecentForwardTargetKeys = () => {
    if (typeof window === 'undefined') {
        return []
    }
    try {
        const rawValue = window.localStorage.getItem(FORWARD_RECENT_STORAGE_KEY)
        if (!rawValue) {
            return []
        }
        const parsed = JSON.parse(rawValue)
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed.filter((item): item is string => typeof item === 'string').slice(0, FORWARD_RECENT_LIMIT)
    } catch {
        return []
    }
}

const persistRecentForwardTarget = (targetKey: string) => {
    recentForwardTargetKeys.value = [targetKey, ...recentForwardTargetKeys.value.filter((item) => item !== targetKey)].slice(0, FORWARD_RECENT_LIMIT)
    if (typeof window === 'undefined') {
        return
    }
    window.localStorage.setItem(FORWARD_RECENT_STORAGE_KEY, JSON.stringify(recentForwardTargetKeys.value))
}

const buildForwardMessageSummary = () => {
    if (forwardingMessageIds.value.length > 1) {
        return `${forwardingMessageIds.value.length} 条消息`
    }
    const currentMessage = chatStore.activeMessages.find((item) => item.id === forwardingMessageIds.value[0]) || messageMenuMessage.value
    const preview = trimText(currentMessage ? getMessageQuotePreview(currentMessage) : '这条消息')
    return `“${preview.length > 22 ? `${preview.slice(0, 22)}...` : preview || '这条消息'}”`
}

const resolveForwardTargetConversationId = async (target: ForwardTargetOption) => {
    if (target.conversationId) {
        return target.conversationId
    }
    if (target.targetType !== 'friend' || !target.userId) {
        throw new Error('无法识别转发目标')
    }
    const { data } = await openDirectConversationApi(target.userId)
    await Promise.all([chatStore.loadConversations(), chatStore.loadFriends()])
    return data.conversation.id
}

const confirmForwardSelection = (target: ForwardTargetOption) => {
    return new Promise<boolean>((resolve) => {
        let settled = false
        Modal.confirm({
            title: '确认转发',
            content: `是否将${buildForwardMessageSummary()}发送给${target.name}${target.targetType === 'friend' ? '用户' : ''}`,
            okText: '确认',
            cancelText: '取消',
            onOk: () => {
                settled = true
                resolve(true)
            },
            onCancel: () => {
                settled = true
                resolve(false)
            },
            afterClose: () => {
                if (!settled) {
                    resolve(false)
                }
            },
        })
    })
}

const openForwardModal = async () => {
    try {
        await Promise.all([chatStore.loadConversations(), chatStore.loadFriends()])
        recentForwardTargetKeys.value = loadRecentForwardTargetKeys().filter((key) => allForwardTargets.value.some((item) => item.key === key))
        forwardSearchKeyword.value = ''
        selectedForwardTargetKey.value = ''
        forwardModalOpen.value = true
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载转发目标失败'))
    }
}

const handleSelectForwardTarget = async (target: ForwardTargetOption) => {
    if (!forwardingMessageIds.value.length || forwarding.value) {
        return
    }
    selectedForwardTargetKey.value = target.key
    const confirmed = await confirmForwardSelection(target)
    if (!confirmed) {
        return
    }
    forwarding.value = true
    forwardModalOpen.value = false
    try {
        const targetConversationId = await resolveForwardTargetConversationId(target)
        await forwardMessagesApi({
            target_conversation_id: targetConversationId,
            message_ids: forwardingMessageIds.value,
        })
        persistRecentForwardTarget(target.key)
        selectedForwardTargetKey.value = ''
        forwardingMessageIds.value = []
        clearMessageSelection()
        closeMessageMenu()
        message.success('转发成功')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '转发失败'))
    } finally {
        forwarding.value = false
    }
}

const buildForwardConversationTarget = (conversation: ChatConversationItem): ForwardTargetOption => ({
    key: `conversation:${conversation.id}`,
    targetType: 'conversation',
    conversationId: conversation.id,
    userId: conversation.direct_target?.id || null,
    name: conversation.name,
    avatar: conversation.avatar || conversation.direct_target?.avatar || '',
    description: conversation.last_message_preview || (conversation.type === 'group' ? '群聊' : '私聊'),
    searchText: `${conversation.name} ${conversation.last_message_preview || ''} ${conversation.direct_target?.display_name || ''} ${conversation.direct_target?.username || ''}`.toLowerCase(),
    sortTime: conversation.last_message_at || '',
})

const buildForwardFriendTarget = (friend: ChatFriendshipItem): ForwardTargetOption => ({
    key: `friend:${friend.friend_user.id}`,
    targetType: 'friend',
    conversationId: friend.direct_conversation?.id || null,
    userId: friend.friend_user.id,
    name: friend.remark || friend.friend_user.display_name || friend.friend_user.username,
    avatar: friend.friend_user.avatar || '',
    description: friend.friend_user.username,
    searchText: `${friend.remark || ''} ${friend.friend_user.display_name || ''} ${friend.friend_user.username || ''}`.toLowerCase(),
    sortTime: friend.accepted_at || '',
})

const allForwardTargets = computed<ForwardTargetOption[]>(() => {
    const targetMap = new Map<string, ForwardTargetOption>()
    for (const conversation of chatStore.conversations) {
        if (conversation.access_mode !== 'member' || !conversation.can_send_message) {
            continue
        }
        const target = buildForwardConversationTarget(conversation)
        targetMap.set(target.key, target)
    }
    for (const friend of chatStore.friends) {
        const target = buildForwardFriendTarget(friend)
        if (target.conversationId) {
            const existingKey = `conversation:${target.conversationId}`
            if (targetMap.has(existingKey)) {
                continue
            }
        }
        targetMap.set(target.key, target)
    }
    return Array.from(targetMap.values()).sort((left, right) => {
        if (left.sortTime === right.sortTime) {
            return left.name.localeCompare(right.name, 'zh-CN')
        }
        return right.sortTime.localeCompare(left.sortTime)
    })
})

const recentForwardTargets = computed(() => recentForwardTargetKeys.value.map((key) => allForwardTargets.value.find((item) => item.key === key)).filter(Boolean) as ForwardTargetOption[])

const filteredForwardTargets = computed(() => {
    const keyword = forwardSearchKeyword.value.trim().toLowerCase()
    if (!keyword) {
        return allForwardTargets.value
    }
    return allForwardTargets.value.filter((item) => item.searchText.includes(keyword))
})

const scheduleSearchSync = (keyword: string, assign: (value: string) => void, timerKey: 'member' | 'invite') => {
    const normalized = keyword.trim()
    const currentTimer = timerKey === 'member' ? memberSearchTimer : inviteSearchTimer
    if (currentTimer) {
        window.clearTimeout(currentTimer)
    }
    const nextTimer = window.setTimeout(() => {
        assign(normalized)
        if (timerKey === 'member') {
            memberSearchTimer = null
            return
        }
        inviteSearchTimer = null
    }, 220)
    if (timerKey === 'member') {
        memberSearchTimer = nextTimer
        return
    }
    inviteSearchTimer = nextTimer
}

const openMemberModal = () => {
    memberSearchKeyword.value = ''
    memberSearchTerm.value = ''
    memberModalOpen.value = true
}

const openInviteModal = async () => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.loadFriends()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加载好友列表失败'))
        return
    }
    inviteSearchKeyword.value = ''
    inviteSearchTerm.value = ''
    selectedInviteUserIds.value = []
    inviteModalOpen.value = true
}

const toggleInviteUser = (userId: number) => {
    selectedInviteUserIds.value = selectedInviteUserIds.value.includes(userId)
        ? selectedInviteUserIds.value.filter((item) => item !== userId)
        : [...selectedInviteUserIds.value, userId]
}

const getAssetMessagePayload = (messageItem: ChatMessageItem): ChatMessageAssetPayload | null => {
    if (messageItem.message_type !== 'image' && messageItem.message_type !== 'file') {
        return null
    }
    const payload = messageItem.payload as Partial<ChatMessageAssetPayload>
    if (!payload || (!payload.asset_reference_id && !payload.source_asset_reference_id && !payload.url)) {
        return null
    }
    return payload as ChatMessageAssetPayload
}

const isAssetMessage = (messageItem: ChatMessageItem) => Boolean(getAssetMessagePayload(messageItem))

const getAssetDisplayName = (messageItem: ChatMessageItem) => getAssetMessagePayload(messageItem)?.display_name || messageItem.content || '附件'

const canPreviewImage = (messageItem: ChatMessageItem) => messageItem.message_type === 'image' && Boolean(getAssetMessagePayload(messageItem)?.url)

const formatAssetFileSize = (messageItem: ChatMessageItem) => {
    const fileSize = Number(getAssetMessagePayload(messageItem)?.file_size || 0)
    return fileSize > 0 ? formatFileSize(fileSize) : '大小未知'
}

const showGroupSenderLine = (messageItem: ChatMessageItem) => chatStore.activeConversation?.type === 'group' && !messageItem.is_system

const getSenderLabel = (messageItem: ChatMessageItem) => {
    if (chatStore.activeConversation?.type === 'group') {
        const member = chatStore.activeMembers.find((item) => item.user.id === messageItem.sender?.id)
        if (member?.group_nickname) {
            return member.group_nickname
        }
        if (member?.friend_remark) {
            return member.friend_remark
        }
    }
    if (messageItem.sender?.display_name) {
        return messageItem.sender.display_name
    }
    return messageItem.sender?.username || '未知成员'
}

const getReplyPayload = (messageItem: ChatMessageItem) => {
    const payload = messageItem.payload as { reply_to_message?: ChatMessageReplyPayload }
    return payload.reply_to_message || null
}

const handleReplyJump = async (replyPayload: ChatMessageReplyPayload) => {
    if (!chatStore.activeConversationId) {
        return
    }
    const located = await scrollToSequence(replyPayload.sequence)
    if (located) {
        return
    }
    try {
        await chatStore.loadMessages(chatStore.activeConversationId, { around_sequence: replyPayload.sequence, limit: 30 })
        const loaded = await scrollToSequence(replyPayload.sequence)
        if (!loaded) {
            message.info('未找到引用消息')
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '跳转引用消息失败'))
    }
}

const getForwardedPayload = (messageItem: ChatMessageItem) => {
    const payload = messageItem.payload as { forwarded_from_message?: ChatMessageForwardedPayload }
    return payload.forwarded_from_message || null
}

const getGroupInvitationPayload = (messageItem: ChatMessageItem) => {
    const payload = messageItem.payload as { group_invitation?: ChatGroupInvitationPayload }
    return payload.group_invitation || null
}

const activeGroupInvitation = computed(() => (activeInvitationMessage.value ? getGroupInvitationPayload(activeInvitationMessage.value) : null))

const buildComposerAttachmentToken = (options: {
    sourceAssetReferenceId: number
    displayName: string
    mediaType: string
    mimeType?: string
    fileSize?: number
    url?: string
}): ChatComposerAttachmentToken => ({
    token_id: `composer_attachment_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    source_asset_reference_id: options.sourceAssetReferenceId,
    display_name: options.displayName,
    media_type: options.mediaType,
    mime_type: options.mimeType || '',
    file_size: options.fileSize,
    url: options.url || '',
})

const buildAttachmentClipboardHtml = (messageItem: ChatMessageItem) => {
    const payload = getAssetMessagePayload(messageItem)
    if (!payload) {
        return ''
    }
    const fileSizeText = payload.file_size ? formatFileSize(payload.file_size) : '大小未知'
    return `<span class="composer-attachment-chip" contenteditable="false" data-solbot-attachment="1" data-token-id="copied_${messageItem.id}" data-source-asset-reference-id="${payload.source_asset_reference_id || payload.asset_reference_id}" data-display-name="${escapeHtml(getAssetDisplayName(messageItem))}" data-media-type="${escapeHtml(payload.media_type || messageItem.message_type)}" data-mime-type="${escapeHtml(payload.mime_type || '')}" data-file-size="${payload.file_size || ''}" data-url="${escapeHtml(payload.url || '')}"><span class="composer-attachment-chip__icon">F</span><span class="composer-attachment-chip__body"><span class="composer-attachment-chip__name">${escapeHtml(getAssetDisplayName(messageItem))}</span><span class="composer-attachment-chip__size">${escapeHtml(fileSizeText)}</span></span></span>`
}

const hasAssetUrl = (messageItem: ChatMessageItem) => Boolean(getAssetMessagePayload(messageItem)?.url)

const hasMessageBubbleAction = (messageItem: ChatMessageItem) => Boolean(getGroupInvitationPayload(messageItem) || hasAssetUrl(messageItem))

const openAssetMessage = (messageItem: ChatMessageItem) => {
    if (!hasAssetUrl(messageItem)) {
        return
    }
    window.open(getAssetMessagePayload(messageItem)?.url, '_blank', 'noopener,noreferrer')
}

const openGroupInvitationModal = (messageItem: ChatMessageItem) => {
    if (!getGroupInvitationPayload(messageItem)) {
        return
    }
    activeInvitationMessage.value = messageItem
    groupInvitationModalOpen.value = true
}

const handleMessageBubbleClick = (messageItem: ChatMessageItem) => {
    if (getGroupInvitationPayload(messageItem)) {
        openGroupInvitationModal(messageItem)
        return
    }
    openAssetMessage(messageItem)
}

const isMessageSelected = (messageId: number) => selectedMessageIds.value.includes(messageId)

const toggleMessageSelected = (messageId: number) => {
    selectedMessageIds.value = isMessageSelected(messageId)
        ? selectedMessageIds.value.filter((item) => item !== messageId)
        : [...selectedMessageIds.value, messageId]
}

const handleMessageRowClick = (messageItem: ChatMessageItem, event: MouseEvent) => {
    if (!messageSelectionMode.value || messageItem.is_system) {
        return
    }
    event.preventDefault()
    event.stopPropagation()
    toggleMessageSelected(messageItem.id)
}

const clearMessageSelection = () => {
    selectedMessageIds.value = []
    messageSelectionMode.value = false
}

const getMessageQuotePreview = (messageItem: ChatMessageItem) => {
    if (isAssetMessage(messageItem)) {
        return `[附件] ${getAssetDisplayName(messageItem)}`
    }
    return trimText(messageItem.content) || '空消息'
}

const closeMessageMenu = () => {
    messageMenuOpen.value = false
    messageMenuMessage.value = null
}

const handleDocumentClick = () => {
    closeMessageMenu()
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
    if (composerDisabled.value) {
        if (composerBlockedReason.value) {
            message.warning(composerBlockedReason.value)
        }
        return
    }
    const segments = composerRef.value?.getSegments() || []
    if (!segments.length) {
        message.warning('消息不能为空')
        return
    }
    const quotedMessageId = quotedMessage.value?.id
    try {
        for (const segment of segments) {
            if (segment.kind === 'text') {
                await chatStore.sendTextMessage(segment.text, quotedMessageId)
                continue
            }
            await chatStore.sendAttachmentMessage({
                sourceAssetReferenceId: segment.attachment.source_asset_reference_id,
                displayName: segment.attachment.display_name,
                mediaType: segment.attachment.media_type,
                mimeType: segment.attachment.mime_type,
                fileSize: segment.attachment.file_size,
                url: segment.attachment.url,
                quotedMessageId,
            })
        }
        composerRef.value?.clear()
        quotedMessage.value = null
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '发送消息失败'))
    } finally {
        chatStore.sendTyping(false)
    }
}

const triggerAttachmentSelect = () => {
    const guardMessage = getAttachmentSendGuardMessage()
    if (guardMessage || attachmentUploading.value) {
        if (guardMessage) {
            message.warning(guardMessage)
        }
        return
    }
    attachmentInputRef.value?.click()
}

const openResourceAttachmentPicker = async () => {
    const guardMessage = getAttachmentSendGuardMessage()
    if (guardMessage) {
        message.warning(guardMessage)
        return
    }
    if (!chatStore.activeConversationId) {
        message.warning('请先选择会话')
        return
    }
    assetPickerOpen.value = true
}

const handleAssetPickerSelect = async (item: FileEntryItem | SearchFileEntryItem) => {
    try {
        const payload = buildAttachmentSendPayloadFromEntry(item)
        composerRef.value?.insertAttachment(buildComposerAttachmentToken({
            sourceAssetReferenceId: payload.sourceAssetReferenceId,
            displayName: payload.displayName,
            mediaType: payload.mediaType,
            mimeType: payload.mimeType,
            fileSize: payload.fileSize,
            url: payload.url,
        }))
        message.success('附件已加入输入框')
    } catch (error: unknown) {
        assetPickerOpen.value = true
        message.error(getErrorMessage(error, '加入附件失败'))
    }
}

const handleComposerMenuClick = ({ key }: { key: string }) => {
    if (key === 'attachment') {
        triggerAttachmentSelect()
        return
    }
    if (key === 'asset-picker') {
        void openResourceAttachmentPicker()
    }
}

const handleAttachmentSelection = async (event: Event) => {
    const input = event.target as HTMLInputElement | null
    const files = Array.from(input?.files || [])
    if (input) {
        input.value = ''
    }
    if (!files.length) {
        return
    }
    const guardMessage = getAttachmentSendGuardMessage()
    if (guardMessage) {
        message.warning(guardMessage)
        return
    }
    if (!authStore.accessToken) {
        message.error('登录状态无效，无法发送附件')
        return
    }

    attachmentUploading.value = true
    let successCount = 0
    try {
        for (const file of files) {
            const result = await uploadFileWithCategory({
                file,
                token: authStore.accessToken,
            })
            const payload = buildAttachmentSendPayloadFromUploadResult(result, file)
            composerRef.value?.insertAttachment(buildComposerAttachmentToken({
                sourceAssetReferenceId: payload.sourceAssetReferenceId,
                displayName: payload.displayName,
                mediaType: payload.mediaType,
                mimeType: payload.mimeType,
                fileSize: payload.fileSize,
                url: payload.url,
            }))
            successCount += 1
        }
        if (successCount > 0) {
            message.success(successCount === 1 ? '附件已加入输入框' : `已加入 ${successCount} 个附件`)
        }
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '加入附件失败'))
    } finally {
        attachmentUploading.value = false
    }
}

const handleComposerTypingChange = (hasContent: boolean) => {
    chatStore.sendTyping(hasContent)
    stopTypingSoon()
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
            await Promise.all([chatStore.loadMembers(chatStore.activeConversationId), chatStore.loadFriends()])
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

const handleInviteMembers = async () => {
    if (!chatStore.activeConversationId || !selectedInviteUserIds.value.length) {
        return
    }
    try {
        for (const userId of selectedInviteUserIds.value) {
            await chatStore.inviteMember(chatStore.activeConversationId, userId)
        }
        const invitedCount = selectedInviteUserIds.value.length
        selectedInviteUserIds.value = []
        inviteModalOpen.value = false
        message.success(invitedCount === 1 ? '邀请消息已发送' : `已发送 ${invitedCount} 条邀请消息`)
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

const handleMuteMember = async (userId: number, muteMinutes = 10) => {
    if (!chatStore.activeConversationId) {
        return
    }
    try {
        await chatStore.muteMember(chatStore.activeConversationId, userId, muteMinutes, muteMinutes > 0 ? '前端快捷禁言' : '解除禁言')
        await chatStore.loadMembers(chatStore.activeConversationId)
        message.success(muteMinutes > 0 ? `已禁言 ${formatMuteMinutesLabel(muteMinutes)}` : '已解除禁言')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, muteMinutes > 0 ? '禁言成员失败' : '解除禁言失败'))
    }
}

const formatMuteMinutesLabel = (muteMinutes: number) => {
    if (muteMinutes % (60 * 24) === 0) {
        return `${muteMinutes / (60 * 24)} 天`
    }
    if (muteMinutes % 60 === 0) {
        return `${muteMinutes / 60} 小时`
    }
    return `${muteMinutes} 分钟`
}

const handleMemberActionMenuClick = async (member: ChatConversationMemberItem, event: { key: string }) => {
    if (!chatStore.activeConversationId) {
        return
    }
    if (event.key.startsWith('mute:')) {
        const muteMinutes = Number(event.key.split(':')[1] || 0)
        if (muteMinutes > 0) {
            await handleMuteMember(member.user.id, muteMinutes)
        }
        return
    }
    if (event.key === 'unmute') {
        await handleMuteMember(member.user.id, 0)
        return
    }
    if (event.key === 'toggle-role') {
        await handleToggleMemberRole(member.user.id, member.role === 'admin' ? 'member' : 'admin')
        return
    }
    if (event.key === 'remove') {
        if (window.confirm('确认移出该成员？')) {
            await handleRemoveMember(member.user.id)
        }
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

const openMessageMenu = (event: MouseEvent, messageItem: ChatMessageItem) => {
    const preferLeft = event.clientX + MESSAGE_MENU_WIDTH + MESSAGE_MENU_VIEWPORT_PADDING > window.innerWidth
    const preferTop = event.clientY + MESSAGE_MENU_MIN_HEIGHT + MESSAGE_MENU_VIEWPORT_PADDING > window.innerHeight
    messageMenuPosition.value = {
        x: preferLeft ? Math.max(MESSAGE_MENU_VIEWPORT_PADDING, event.clientX - MESSAGE_MENU_WIDTH) : event.clientX,
        y: preferTop ? Math.max(MESSAGE_MENU_VIEWPORT_PADDING, event.clientY - MESSAGE_MENU_MIN_HEIGHT) : event.clientY,
    }
    messageMenuMessage.value = messageItem
    messageMenuOpen.value = true
}

const handleRetryMessage = async () => {
    if (!messageMenuMessage.value) {
        return
    }
    try {
        await chatStore.retryMessage(messageMenuMessage.value)
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '重新发送失败'))
    } finally {
        closeMessageMenu()
    }
}

const handleCopyMessage = async () => {
    if (!messageMenuMessage.value) {
        return
    }
    try {
        const selectedText = window.getSelection()?.toString().trim() || ''
        if (selectedText) {
            await navigator.clipboard.writeText(selectedText)
            message.success('已复制选中文本')
            closeMessageMenu()
            return
        }
        if (isAssetMessage(messageMenuMessage.value) && 'ClipboardItem' in window && navigator.clipboard.write) {
            const html = buildAttachmentClipboardHtml(messageMenuMessage.value)
            const text = [getAssetDisplayName(messageMenuMessage.value), getAssetMessagePayload(messageMenuMessage.value)?.url || ''].filter(Boolean).join('\n')
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                    'text/html': new Blob([html], { type: 'text/html' }),
                }),
            ])
            message.success('文件盒子已复制')
            closeMessageMenu()
            return
        }
        const content = isAssetMessage(messageMenuMessage.value)
            ? [getAssetDisplayName(messageMenuMessage.value), getAssetMessagePayload(messageMenuMessage.value)?.url || ''].filter(Boolean).join('\n')
            : messageMenuMessage.value.content
        await navigator.clipboard.writeText(content)
        message.success('消息已复制')
    } catch {
        message.error('复制失败')
    } finally {
        closeMessageMenu()
    }
}

const handleForwardMessage = () => {
    if (!messageMenuMessage.value) {
        return
    }
    forwardingMessageIds.value = [messageMenuMessage.value.id]
    closeMessageMenu()
    void openForwardModal()
}

const handleForwardSelection = () => {
    if (!selectedMessageIds.value.length) {
        message.warning('请先选择消息')
        return
    }
    forwardingMessageIds.value = [...selectedMessageIds.value]
    void openForwardModal()
}

const handleQuoteMessage = () => {
    if (!messageMenuMessage.value) {
        return
    }
    quotedMessage.value = messageMenuMessage.value
    closeMessageMenu()
}

const enableMessageSelection = (messageItem: ChatMessageItem) => {
    messageSelectionMode.value = true
    if (!isMessageSelected(messageItem.id)) {
        selectedMessageIds.value = [...selectedMessageIds.value, messageItem.id]
    }
    closeMessageMenu()
}

const handleApplyGroupInvitation = async () => {
    const invitation = activeGroupInvitation.value
    if (!invitation) {
        return
    }
    groupInvitationApplying.value = true
    try {
        const { data } = await applyGroupInvitationApi({
            conversation_id: invitation.conversation_id,
            inviter_user_id: invitation.inviter.id,
        })
        await Promise.all([chatStore.loadConversations(), chatStore.loadContactGroupConversations()])
        if (data.mode === 'joined' && data.conversation?.id) {
            await chatStore.selectConversation(data.conversation.id)
        }
        groupInvitationModalOpen.value = false
        message.success(data.detail || '申请已提交')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '申请入群失败'))
    } finally {
        groupInvitationApplying.value = false
    }
}

const updateComposerHeight = (nextHeight: number) => {
    settingsStore.save({
        chatLayout: {
            ...settingsStore.chatLayout,
            composerHeight: Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, Math.round(nextHeight))),
        },
    })
}

const handleComposerResize = (event: MouseEvent) => {
    if (!composerResizeState.value) {
        return
    }
    updateComposerHeight(composerResizeState.value.composerHeight - (event.clientY - composerResizeState.value.startY))
}

const stopComposerResize = () => {
    if (!composerResizeState.value) {
        return
    }
    composerResizeState.value = null
    window.removeEventListener('mousemove', handleComposerResize)
    window.removeEventListener('mouseup', stopComposerResize)
    void settingsStore.saveChatPreferences({ chatLayout: settingsStore.chatLayout })
}

const startComposerResize = (event: MouseEvent) => {
    event.preventDefault()
    composerResizeState.value = {
        startY: event.clientY,
        composerHeight: settingsStore.chatLayout.composerHeight,
    }
    window.addEventListener('mousemove', handleComposerResize)
    window.addEventListener('mouseup', stopComposerResize)
}

watch(
    () => chatStore.activeConversationId,
    () => {
        clearMessageSelection()
        quotedMessage.value = null
        forwardModalOpen.value = false
        forwardingMessageIds.value = []
        forwardSearchKeyword.value = ''
        selectedForwardTargetKey.value = ''
        memberModalOpen.value = false
        inviteModalOpen.value = false
        memberSearchKeyword.value = ''
        inviteSearchKeyword.value = ''
        memberSearchTerm.value = ''
        inviteSearchTerm.value = ''
        selectedInviteUserIds.value = []
        groupInvitationModalOpen.value = false
        activeInvitationMessage.value = null
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

watch(memberSearchKeyword, (value) => {
    scheduleSearchSync(value, (nextValue) => {
        memberSearchTerm.value = nextValue
    }, 'member')
})

watch(inviteSearchKeyword, (value) => {
    scheduleSearchSync(value, (nextValue) => {
        inviteSearchTerm.value = nextValue
    }, 'invite')
})

onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
    recentForwardTargetKeys.value = loadRecentForwardTargetKeys()
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
    if (typingStopTimer.value) {
        window.clearTimeout(typingStopTimer.value)
    }
    if (focusedSequenceTimer.value) {
        window.clearTimeout(focusedSequenceTimer.value)
    }
    if (memberSearchTimer) {
        window.clearTimeout(memberSearchTimer)
        memberSearchTimer = null
    }
    if (inviteSearchTimer) {
        window.clearTimeout(inviteSearchTimer)
        inviteSearchTimer = null
    }
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }
    stopComposerResize()
})

function escapeHtml(value: string) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}
</script>

<style scoped>
.chat-main {
    display: grid;
    min-width: 0;
    height: 100%;
    background: var(--chat-panel-bg);
    border: 1px solid var(--chat-panel-border);
    border-radius: 0 14px 14px 0;
    overflow: hidden;
    box-shadow: var(--chat-panel-shadow);
}

.chat-main__header,
.chat-main__history-toolbar,
.chat-main__composer {
    padding: 12px 16px;
}

.chat-main__header,
.chat-main__header-main,
.chat-main__title-row,
.chat-main__composer-actions,
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
    font-size: 18px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.chat-main__header-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.chat-main__title-row {
    justify-content: flex-start;
    min-width: 0;
}

.chat-main__meta-tag {
    flex: 0 0 auto;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--chat-accent-soft);
    color: var(--chat-accent);
    font-size: 12px;
    font-weight: 600;
}

.chat-main__meta,
.message-bubble__meta,
.system-bubble,
.drawer-list-desc {
    color: var(--chat-text-secondary);
}

.chat-main__meta {
    font-size: 12px;
    justify-content: flex-start;
}

.chat-menu-trigger {
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 10px;
}

.chat-main__history-toolbar {
    padding-top: 8px;
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
}

.chat-main__messages,
.drawer-list {
    overflow: auto;
}

.chat-main__attachment-input {
    display: none;
}

.chat-main__messages {
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--chat-subtle-bg) 90%, transparent), var(--chat-panel-bg-strong));
}

.message-row {
    display: flex;
    align-items: flex-start;
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

.message-row__content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    max-width: 100%;
    min-width: 0;
    flex: 1 1 auto;
    order: 1;
}

.message-row__content.self {
    justify-content: flex-end;
}

.message-row__avatar {
    flex: 0 0 auto;
    margin-top: 2px;
}

.message-row--selection-mode {
    cursor: pointer;
}

.message-row__select {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    order: 2;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    pointer-events: none;
    flex: 0 0 24px;
}

.message-row.self .message-row__select {
    order: 0;
}

.message-row__select-indicator {
    position: relative;
    width: 18px;
    height: 18px;
    border: 1.5px solid color-mix(in srgb, var(--chat-accent) 54%, var(--chat-panel-border));
    border-radius: 999px;
    background: var(--chat-panel-bg-strong);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.message-row__select.is-checked .message-row__select-indicator {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
}

.message-row__select.is-checked .message-row__select-indicator::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 2px;
    width: 4px;
    height: 8px;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(45deg);
}

.message-bubble-wrap {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    width: auto;
    min-width: 0;
    max-width: 80%;
}

.message-bubble-wrap.self {
    align-items: flex-end;
}

.message-bubble__sender-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.message-bubble__sender-line.self {
    justify-content: flex-end;
}

.message-bubble-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    max-width: 100%;
    min-width: 0;
}

.message-bubble-row.self {
    justify-content: flex-end;
}

.message-row--focused {
    background: color-mix(in srgb, var(--chat-accent-soft) 82%, var(--chat-panel-bg));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chat-accent) 22%, transparent), 0 10px 24px color-mix(in srgb, var(--chat-accent) 10%, transparent);
}

.message-bubble {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: auto;
    min-width: 0;
    max-width: min(100%, 560px);
    padding: 12px 14px;
    border-radius: 18px 18px 18px 6px;
    background: var(--chat-message-bg);
    color: var(--chat-text-primary);
    writing-mode: horizontal-tb;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.1);
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease, background-color 0.18s ease;
}

.message-bubble__text {
    min-width: 0;
    writing-mode: horizontal-tb;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.6;
}

.message-bubble__sender {
    padding: 0 2px;
    padding-top: 2px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    line-height: 1.2;
}

.message-bubble--interactive {
    cursor: pointer;
}

.message-bubble:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
}

.message-bubble.self:hover {
    filter: brightness(1.03);
}

.message-bubble__time {
    flex: 0 0 auto;
    min-width: 44px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    opacity: 0;
    transform: translateX(6px);
    transition: opacity 0.2s ease 0.5s, transform 0.2s ease 0.5s;
}

.message-bubble__time.self {
    transform: translateX(-6px);
}

.message-row:hover .message-bubble__time {
    opacity: 1;
    transform: translateX(0);
}

.attachment-bubble {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(360px, 100%);
    min-width: min(300px, 100%);
    max-width: 100%;
    box-sizing: border-box;
}

.attachment-bubble__preview {
    display: block;
    max-width: min(280px, 100%);
    max-height: 220px;
    border-radius: 14px;
    object-fit: cover;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
}

.attachment-bubble__body {
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

.attachment-bubble__name {
    font-weight: 600;
    line-height: 1.5;
    word-break: break-word;
}

.attachment-bubble__size {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
}

.attachment-file-card {
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

.attachment-file-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: rgba(47, 57, 69, 0.1);
    font-size: 20px;
}

.attachment-file-card__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

.attachment-file-card__name {
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.attachment-file-card__size {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
}

.attachment-bubble__link {
    width: fit-content;
    font-size: 12px;
    color: inherit;
    opacity: 0.82;
    text-decoration: underline;
}

.attachment-bubble__link:hover {
    opacity: 1;
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
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.chat-main__composer-actions {
    justify-content: flex-end;
}

.chat-main__composer-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.chat-main__composer-trigger {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 12px;
}

.chat-main__composer-input {
    flex: 1 1 auto;
    min-height: 0;
}

.chat-main__composer-input :deep(textarea) {
    min-height: 96px !important;
    height: 100% !important;
    resize: none !important;
}

.chat-main__composer-input :deep(.ant-input) {
    resize: none !important;
}

.chat-main__composer-input :deep(textarea::-webkit-resizer) {
    display: none;
}

.chat-main__composer-resizer {
    position: relative;
    height: 1px;
    margin-top: 8px;
    background: color-mix(in srgb, var(--chat-panel-border) 88%, transparent);
    cursor: row-resize;
    z-index: 2;
}

.chat-main__composer-resizer::before {
    content: none;
}

.chat-main__composer-resizer:hover {
    background: color-mix(in srgb, var(--chat-accent) 72%, var(--chat-panel-border));
}

.chat-main__selection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--chat-accent-soft) 76%, var(--chat-panel-bg-strong));
    color: var(--chat-text-primary);
}

.chat-main__quote-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--chat-accent-soft) 72%, var(--chat-panel-bg-strong));
}

.chat-main__quote-title {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.chat-main__quote-content {
    margin-top: 4px;
    color: var(--chat-text-primary);
    word-break: break-word;
}

.chat-main__quote-close {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--chat-accent);
    cursor: pointer;
}

.message-bubble__reply {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    margin-bottom: 10px;
    padding: 10px 12px;
    border: 0;
    border-radius: 12px;
    background: color-mix(in srgb, var(--chat-subtle-bg) 86%, var(--chat-panel-bg-strong));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chat-panel-border) 82%, transparent);
    text-align: left;
    cursor: pointer;
}

.message-bubble__reply:hover {
    background: color-mix(in srgb, var(--chat-accent-soft) 52%, var(--chat-panel-bg-strong));
}

.message-bubble.self .message-bubble__reply {
    background: rgba(255, 255, 255, 0.24);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.message-bubble.self .message-bubble__reply:hover {
    background: rgba(255, 255, 255, 0.3);
}

.message-bubble__reply-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    color: var(--chat-accent);
}

.message-bubble.self .message-bubble__reply-arrow {
    color: rgba(255, 255, 255, 0.92);
}

.message-bubble__reply-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.message-bubble__reply-sender {
    font-size: 12px;
    font-weight: 700;
    color: var(--chat-text-primary);
}

.message-bubble__reply-content {
    color: var(--chat-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.message-bubble.self .message-bubble__reply-sender,
.message-bubble.self .message-bubble__reply-content,
.message-bubble.self .group-invitation-card__meta,
.message-bubble.self .group-invitation-card__desc,
.message-bubble.self .group-invitation-card__footer {
    color: rgba(255, 255, 255, 0.9);
}

.group-invitation-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: min(300px, 100%);
    max-width: 100%;
    padding: 12px 14px;
    border: 0;
    border-radius: 14px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    text-align: left;
    cursor: pointer;
}

.group-invitation-card.self {
    background: rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    color: #fff;
}

.group-invitation-card__header {
    font-size: 12px;
    font-weight: 700;
}

.group-invitation-card__main,
.group-invitation-modal__summary,
.group-invitation-modal__actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.group-invitation-card__body,
.group-invitation-modal__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.group-invitation-card__name,
.group-invitation-modal__name {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
}

.group-invitation-card__meta,
.group-invitation-modal__meta,
.group-invitation-modal__desc,
.group-invitation-card__desc,
.group-invitation-card__footer {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.72);
}

.group-invitation-card__meta {
    display: flex;
    align-items: center;
    gap: 6px;
}

.group-invitation-card__footer,
.group-invitation-modal__actions {
    justify-content: space-between;
}

.group-invitation-modal {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.group-invitation-modal__summary {
    align-items: flex-start;
}

.settings-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 12px;
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--chat-panel-border) 84%, rgba(15, 23, 42, 0.14));
    border-radius: 18px;
    background: transparent;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chat-panel-border) 72%, transparent);
}

.settings-section--danger {
    margin-bottom: 0;
}

.drawer-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    align-items: center;
}

.member-item__main {
    justify-content: flex-start;
    min-width: 0;
    flex: 1 1 0;
}

.member-item__mute {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 0;
    flex: 0 1 220px;
    font-size: 12px;
    color: var(--chat-text-secondary);
    white-space: nowrap;
}

.member-item__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
    align-self: center;
}

.member-item__menu-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 22px;
    padding: 0;
}

.member-item__menu-trigger :deep(.anticon) {
    font-size: 18px;
    line-height: 1;
}

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

.forward-modal__recent-desc,
.forward-modal__desc,
.forward-modal__type {
    font-size: 12px;
    color: var(--chat-text-secondary);
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
    grid-template-columns: auto minmax(0, 1fr) auto;
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
    gap: 4px;
    min-width: 0;
}

.entity-modal {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.entity-modal__search {
    display: flex;
    align-items: center;
}

.entity-modal__list {
    min-height: 380px;
    margin-top: 10px;
}

.entity-modal__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 4px;
}

.entity-modal__selection {
    font-size: 12px;
    color: var(--chat-text-secondary);
}

.invite-item {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
}

.invite-item__check {
    display: inline-flex;
    align-items: center;
    align-self: stretch;
}

.invite-item__main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
}

.invite-item__check :deep(.ant-checkbox-inner) {
    width: 18px;
    height: 18px;
    border-radius: 999px;
}

.invite-item__check :deep(.ant-checkbox-checked .ant-checkbox-inner::after) {
    inset-inline-start: 24%;
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
    min-height: 40px;
    padding: 0;
    border: 0;
    background: transparent;
}

.member-preview--add {
    width: 40px;
    height: 40px;
    border: 2px dashed color-mix(in srgb, var(--chat-accent) 34%, transparent);
    border-radius: 50%;
    cursor: pointer;
}

.member-preview__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
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
    margin-top: 0;
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

.message-menu-fade-enter-active,
.message-menu-fade-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.message-menu-fade-enter-from,
.message-menu-fade-leave-to {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
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

    .attachment-bubble,
    .group-invitation-card {
        min-width: 100%;
    }

    .group-basic-panel {
        flex-direction: column;
    }

    .member-preview-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .forward-modal__topbar {
        grid-template-columns: 1fr;
    }

    .forward-modal__search {
        max-width: none;
    }
}
</style>
