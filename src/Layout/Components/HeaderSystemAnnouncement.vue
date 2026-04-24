<template>
    <div v-if="latestAnnouncement" class="announcement-anchor">
        <a-popover
            v-model:open="popoverOpen"
            trigger="click"
            placement="bottom"
            overlay-class-name="header-announcement-popover"
        >
            <template #content>
                <div class="announcement-popover">
                    <div class="announcement-popover__header">
                        <div>
                            <div class="announcement-popover__title">
                                系统公告
                            </div>
                            <div class="announcement-popover__meta">
                                共 {{ announcements.length }} 条，未读
                                {{ unreadCount }} 条
                            </div>
                        </div>
                        <a-button size="small" @click="handleMarkAllRead"
                            >一键已读</a-button
                        >
                    </div>

                    <div
                        v-if="announcements.length"
                        class="announcement-popover__list"
                    >
                        <button
                            v-for="item in announcements"
                            :key="item.id"
                            type="button"
                            class="announcement-item"
                            :class="{
                                'announcement-item--unread': !item.is_read,
                            }"
                            @click="openAnnouncement(item)"
                        >
                            <span
                                v-if="!item.is_read"
                                class="announcement-item__corner-dot"
                            ></span>
                            <div class="announcement-item__main">
                                <div class="announcement-item__title-row">
                                    <span class="announcement-item__title">{{
                                        item.title
                                    }}</span>
                                    <span class="announcement-item__time">{{
                                        formatDateTime(item.published_at)
                                    }}</span>
                                </div>
                                <div class="announcement-item__content">
                                    {{ item.content }}
                                </div>
                            </div>
                            <div class="announcement-item__actions" @click.stop>
                                <a-button
                                    size="small"
                                    type="text"
                                    @click="openAnnouncement(item)"
                                    >查看</a-button
                                >
                                <a-button
                                    v-if="canPublishAnnouncement"
                                    size="small"
                                    type="text"
                                    danger
                                    @click="handleDelete(item.id)"
                                    >删除</a-button
                                >
                            </div>
                        </button>
                    </div>
                    <a-empty v-else :image="false" description="暂无公告" />
                </div>
            </template>

            <button type="button" class="announcement-trigger">
                <span class="announcement-trigger__label">公告</span>
                <span class="announcement-trigger__title">{{
                    latestAnnouncement.title
                }}</span>
                <span
                    v-if="unreadCount > 0"
                    class="announcement-trigger__badge"
                    >{{ unreadCount }}</span
                >
            </button>
        </a-popover>

        <a-modal
            v-model:open="detailOpen"
            :title="activeAnnouncement?.title || '系统公告'"
            :footer="null"
            width="640px"
        >
            <div v-if="activeAnnouncement" class="announcement-detail">
                <div class="announcement-detail__meta">
                    <span>{{
                        formatDateTime(activeAnnouncement.published_at)
                    }}</span>
                    <span v-if="activeAnnouncement.published_by"
                        >发布人：{{ activeAnnouncement.published_by }}</span
                    >
                </div>
                <div class="announcement-detail__content">
                    {{ activeAnnouncement.content }}
                </div>
            </div>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import dayjs from "dayjs";
import type { SystemAnnouncementItem } from "@/types/system";
import { useSystemStore } from "@/stores/system";
import { useUserStore } from "@/stores/user";
import { getErrorMessage } from "@/utils/error";

const systemStore = useSystemStore();
const userStore = useUserStore();

const popoverOpen = ref(false);
const detailOpen = ref(false);
const activeAnnouncement = ref<SystemAnnouncementItem | null>(null);

const latestAnnouncement = computed(() => systemStore.latestAnnouncement);
const announcements = computed(() => systemStore.announcements);
const unreadCount = computed(() => systemStore.unreadCount);
const canPublishAnnouncement = computed(() =>
    userStore.hasPermission("system.publish_announcement"),
);

const formatDateTime = (value: string | null) =>
    value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "";

const openAnnouncement = async (item: SystemAnnouncementItem) => {
    activeAnnouncement.value = item;
    detailOpen.value = true;
    if (!item.is_read) {
        try {
            await systemStore.markAnnouncementRead(item.id);
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "标记公告已读失败"));
        }
    }
};

const handleMarkAllRead = async () => {
    try {
        await systemStore.markAllAnnouncementsRead();
        message.success("已全部标记已读");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "标记全部已读失败"));
    }
};

const handleDelete = async (announcementId: number) => {
    try {
        await systemStore.deleteAnnouncement(announcementId);
        if (activeAnnouncement.value?.id === announcementId) {
            detailOpen.value = false;
            activeAnnouncement.value = null;
        }
        message.success("公告已删除");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "删除公告失败"));
    }
};

onMounted(() => {
    systemStore.ensureRealtimeSubscription();
    void systemStore.loadAnnouncements().catch(() => undefined);
});
</script>

<style scoped>
.announcement-anchor {
    flex: 0 1 240px;
    min-width: 0;
}

.announcement-trigger {
    width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 34px;
    padding: 0 12px;
    border: 1px solid color-mix(in srgb, var(--text-secondary) 16%, transparent);
    border-radius: 999px;
    background: color-mix(
        in srgb,
        var(--surface-header) 84%,
        var(--surface-sidebar) 16%
    );
    color: var(--text-primary);
    cursor: pointer;
}

.announcement-trigger__label {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--text-secondary);
}

.announcement-trigger__title {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
}

.announcement-trigger__badge {
    flex: 0 0 auto;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: #dc2626;
    color: #fff;
    font-size: 12px;
    line-height: 18px;
}

.announcement-popover {
    width: 420px;
    max-width: min(420px, calc(100vw - 32px));
}

.announcement-popover__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.announcement-popover__title {
    font-size: 16px;
    font-weight: 700;
}

.announcement-popover__meta {
    color: var(--text-secondary);
    font-size: 12px;
    margin-top: 2px;
}

.announcement-popover__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 420px;
    overflow: auto;
}

.announcement-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--text-secondary) 12%, transparent);
    border-radius: 12px;
    background: var(--surface-page);
    cursor: pointer;
    position: relative;
    text-align: left;
}

.announcement-item--unread {
    border-color: color-mix(in srgb, #1677ff 30%, transparent);
    background: color-mix(in srgb, #1677ff 8%, var(--surface-page));
}

.announcement-item__main {
    min-width: 0;
    flex: 1;
    text-align: left;
}

.announcement-item__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.announcement-item__title {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
}

.announcement-item__time {
    color: var(--text-secondary);
    font-size: 12px;
    flex: 0 0 auto;
}

.announcement-item__content {
    margin-top: 4px;
    color: var(--text-secondary);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.announcement-item__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    align-self: center;
}

.announcement-item__corner-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #dc2626;
}

.announcement-detail__meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    color: var(--text-secondary);
    margin-bottom: 12px;
}

.announcement-detail__content {
    white-space: pre-wrap;
    line-height: 1.75;
    color: var(--text-primary);
}
</style>
