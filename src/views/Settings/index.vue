<template>
    <div class="settings-page">
        <a-card>
            <div class="settings-page__toolbar">
                <span
                    class="save-status"
                    :class="`save-status--${saveStatus}`"
                    >{{ saveStatusText }}</span
                >
                <a-button
                    v-if="canPublishAnnouncement"
                    type="primary"
                    @click="announcementModalOpen = true"
                    >发布公告</a-button
                >
            </div>

            <template v-if="isSuperuser">
                <a-form layout="vertical" :model="formState">
                    <a-divider orientation="left">基础设置</a-divider>
                    <a-form-item label="系统标题">
                        <a-input
                            v-model:value="formState.systemTitle"
                            placeholder="请输入系统标题"
                            @blur="handleSystemTitleBlur"
                            @press-enter="handleSystemTitleEnter"
                        />
                    </a-form-item>

                    <a-divider orientation="left">系统维护</a-divider>
                    <a-card :bordered="false" class="maintenance-card">
                        <div
                            class="maintenance-card__row maintenance-card__row--single"
                        >
                            <span class="maintenance-card__title"
                                >系统维护</span
                            >
                            <a-switch
                                :checked="formState.maintenanceEnabled"
                                checked-children="开启"
                                un-checked-children="关闭"
                                :loading="savingMaintenance"
                                @change="handleMaintenanceEnabledChange"
                            />
                            <a-date-picker
                                v-model:value="formState.maintenanceScheduledAt"
                                show-time
                                value-format=""
                                placeholder="不选择则立即维护"
                                style="width: 240px"
                                @change="handleMaintenanceDateChange"
                            />
                            <span class="maintenance-card__countdown-label"
                                >当前状态：</span
                            >
                            <span class="maintenance-card__countdown-value">{{
                                maintenanceCountdownText
                            }}</span>
                        </div>
                    </a-card>
                </a-form>
            </template>
            <template v-else>
                <a-empty description="系统设置仅超级管理员可修改" />
            </template>
        </a-card>

        <a-modal
            v-model:open="announcementModalOpen"
            title="发布系统公告"
            ok-text="发布"
            cancel-text="取消"
            :confirm-loading="publishingAnnouncement"
            @ok="handlePublishAnnouncement"
        >
            <a-form layout="vertical" :model="announcementForm">
                <a-form-item label="标题">
                    <a-input
                        v-model:value="announcementForm.title"
                        :maxlength="255"
                        placeholder="请输入公告标题"
                    />
                </a-form-item>
                <a-form-item label="内容">
                    <a-textarea
                        v-model:value="announcementForm.content"
                        :rows="5"
                        :maxlength="announcementContentMaxLength"
                        placeholder="请输入公告内容"
                        show-count
                        class="announcement-content-textarea"
                    />
                </a-form-item>
            </a-form>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { message } from "ant-design-vue";
import { useSettingsStore } from "@/stores/settings";
import { useSystemStore } from "@/stores/system";
import { useUserStore } from "@/stores/user";
import { getErrorMessage } from "@/utils/error";

const settingsStore = useSettingsStore();
const systemStore = useSystemStore();
const userStore = useUserStore();

const now = ref(dayjs());
const savingMaintenance = ref(false);
const publishingAnnouncement = ref(false);
const announcementModalOpen = ref(false);
const skipNextSystemTitleBlur = ref(false);
const saveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
let saveStatusTimer: ReturnType<typeof setTimeout> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const formState = reactive({
    systemTitle: "",
    maintenanceEnabled: false,
    maintenanceScheduledAt: null as Dayjs | null,
});

const announcementForm = reactive({
    title: "",
    content: "",
});

const isSuperuser = computed(() => userStore.isSuperuser);
const canPublishAnnouncement = computed(() =>
    userStore.hasPermission("system.publish_announcement"),
);
const announcementContentMaxLength = computed(() =>
    Math.max(1, Number(systemStore.announcementContentMaxLength || 300)),
);

const saveStatusText = computed(() => {
    if (saveStatus.value === "saving") {
        return "正在保存...";
    }
    if (saveStatus.value === "saved") {
        return "已保存";
    }
    if (saveStatus.value === "error") {
        return "保存失败";
    }
    return "系统设置";
});

const maintenanceCountdownText = computed(() => {
    const maintenance = systemStore.maintenance;
    if (!maintenance.enabled) {
        return "未开启";
    }
    if (maintenance.is_active) {
        return "维护中";
    }
    if (!maintenance.scheduled_at) {
        return "开启后将立即进入维护";
    }
    const target = dayjs(maintenance.scheduled_at);
    const diffSeconds = Math.max(0, target.diff(now.value, "second"));
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    return `${target.format("YYYY-MM-DD HH:mm:ss")}，倒计时 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

const markSaveStatus = (status: "idle" | "saving" | "saved" | "error") => {
    if (saveStatusTimer) {
        clearTimeout(saveStatusTimer);
        saveStatusTimer = null;
    }
    saveStatus.value = status;
    if (status === "saved") {
        saveStatusTimer = setTimeout(() => {
            saveStatus.value = "idle";
            saveStatusTimer = null;
        }, 1400);
    }
};

const syncFromStore = () => {
    formState.systemTitle = settingsStore.settings.systemTitle;
    formState.maintenanceEnabled = systemStore.maintenance.enabled;
    formState.maintenanceScheduledAt = systemStore.maintenance.scheduled_at
        ? dayjs(systemStore.maintenance.scheduled_at)
        : null;
};

const saveSystemTitle = async () => {
    const nextSystemTitle = formState.systemTitle.trim() || "Hyself 管理后台";
    if (nextSystemTitle === settingsStore.settings.systemTitle) {
        formState.systemTitle = nextSystemTitle;
        return;
    }
    markSaveStatus("saving");
    try {
        await systemStore.updateSystemSettings({
            system_title: nextSystemTitle,
        });
        syncFromStore();
        markSaveStatus("saved");
    } catch (error: unknown) {
        syncFromStore();
        markSaveStatus("error");
        message.error(getErrorMessage(error, "保存系统标题失败"));
    }
};

const saveMaintenanceSettings = async () => {
    savingMaintenance.value = true;
    markSaveStatus("saving");
    try {
        await systemStore.updateSystemSettings({
            maintenance_enabled: formState.maintenanceEnabled,
            maintenance_scheduled_at: formState.maintenanceEnabled
                ? formState.maintenanceScheduledAt?.toISOString() || null
                : null,
        });
        syncFromStore();
        markSaveStatus("saved");
    } catch (error: unknown) {
        syncFromStore();
        markSaveStatus("error");
        message.error(getErrorMessage(error, "保存系统维护设置失败"));
    } finally {
        savingMaintenance.value = false;
    }
};

const handleSystemTitleBlur = async () => {
    if (skipNextSystemTitleBlur.value) {
        skipNextSystemTitleBlur.value = false;
        return;
    }
    await saveSystemTitle();
};

const handleSystemTitleEnter = async (event: KeyboardEvent) => {
    event.preventDefault();
    skipNextSystemTitleBlur.value = true;
    (event.target as HTMLInputElement | null)?.blur();
    await saveSystemTitle();
};

const handleMaintenanceEnabledChange = async (checked: boolean) => {
    formState.maintenanceEnabled = checked;
    if (!checked) {
        formState.maintenanceScheduledAt = null;
    }
    await saveMaintenanceSettings();
};

const handleMaintenanceDateChange = async () => {
    if (!formState.maintenanceEnabled) {
        return;
    }
    await saveMaintenanceSettings();
};

const handlePublishAnnouncement = async () => {
    const title = announcementForm.title.trim();
    const content = announcementForm.content.trim();
    if (!title) {
        message.warning("请输入公告标题");
        return;
    }
    if (!content) {
        message.warning("请输入公告内容");
        return;
    }
    if (content.length > announcementContentMaxLength.value) {
        message.warning(
            `公告内容不能超过${announcementContentMaxLength.value}个字符`,
        );
        return;
    }

    publishingAnnouncement.value = true;
    try {
        await systemStore.publishAnnouncement({ title, content });
        announcementModalOpen.value = false;
        announcementForm.title = "";
        announcementForm.content = "";
        message.success("公告已发布并推送");
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "发布公告失败"));
    } finally {
        publishingAnnouncement.value = false;
    }
};

onMounted(async () => {
    systemStore.ensureRealtimeSubscription();
    try {
        await systemStore.loadSystemSettings({ force: true });
        syncFromStore();
    } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载系统设置失败"));
    }
    countdownTimer = setInterval(() => {
        now.value = dayjs();
    }, 1000);
});

onBeforeUnmount(() => {
    if (saveStatusTimer) {
        clearTimeout(saveStatusTimer);
        saveStatusTimer = null;
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
});
</script>

<style scoped>
.settings-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.settings-page__toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.save-status {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 1;
    transition:
        color 0.18s ease,
        background-color 0.18s ease;
}

.save-status--idle {
    color: var(--text-secondary);
    background: rgba(148, 163, 184, 0.12);
}

.save-status--saving {
    color: #1677ff;
    background: rgba(22, 119, 255, 0.1);
}

.save-status--saved {
    color: #16a34a;
    background: rgba(22, 163, 74, 0.1);
}

.save-status--error {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.1);
}

.maintenance-card {
    background: color-mix(
        in srgb,
        var(--surface-page) 88%,
        var(--surface-sidebar) 12%
    );
}

.maintenance-card__row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    flex-wrap: nowrap;
}

.maintenance-card__row--single {
    overflow-x: auto;
    white-space: nowrap;
}

.maintenance-card__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

.maintenance-card__countdown-label {
    color: var(--text-secondary);
    font-size: 13px;
}

.maintenance-card__countdown-value {
    color: var(--text-primary);
    font-weight: 500;
    font-size: 13px;
}

.announcement-content-textarea :deep(textarea) {
    resize: none;
}
</style>
