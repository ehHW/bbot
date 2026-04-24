import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
    createSystemAnnouncementApi,
    deleteSystemAnnouncementApi,
    getSystemAnnouncementsApi,
    getSystemSettingsApi,
    markAllSystemAnnouncementsReadApi,
    markSystemAnnouncementReadApi,
    updateSystemSettingsApi,
} from '@/api/system'
import { subscribeToRealtimeEvent } from '@/realtime/dispatcher'
import { useSettingsStore } from '@/stores/settings'
import type { SystemAnnouncementItem, SystemMaintenanceState, SystemSettingsPayload } from '@/types/system'

const defaultMaintenanceState: SystemMaintenanceState = {
    enabled: false,
    scheduled_at: null,
    activated_at: null,
    is_active: false,
}

export const useSystemStore = defineStore('system', () => {
    const settingsStore = useSettingsStore()
    const systemTitle = ref(settingsStore.systemTitle)
    const announcementContentMaxLength = ref(300)
    const maintenance = ref<SystemMaintenanceState>({ ...defaultMaintenanceState })
    const announcements = ref<SystemAnnouncementItem[]>([])
    const settingsLoaded = ref(false)
    const announcementsLoaded = ref(false)
    let unsubscribeRealtime: (() => void) | null = null

    const latestAnnouncement = computed(() => announcements.value[0] || null)
    const unreadCount = computed(() => announcements.value.filter((item) => !item.is_read).length)

    const applySystemSettings = (payload: SystemSettingsPayload | null | undefined) => {
        if (!payload) {
            return
        }
        systemTitle.value = payload.system_title || 'Hyself 管理后台'
        announcementContentMaxLength.value = Number(payload.announcement_content_max_length || 300)
        maintenance.value = payload.maintenance || { ...defaultMaintenanceState }
        settingsStore.save({ systemTitle: systemTitle.value })
        settingsLoaded.value = true
    }

    const upsertAnnouncement = (item: SystemAnnouncementItem) => {
        announcements.value = [item, ...announcements.value.filter((current) => current.id !== item.id)]
            .sort((left, right) => String(right.published_at || '').localeCompare(String(left.published_at || '')))
    }

    const removeAnnouncement = (announcementId: number) => {
        announcements.value = announcements.value.filter((item) => item.id !== announcementId)
    }

    const loadSystemSettings = async (options?: { force?: boolean }) => {
        if (settingsLoaded.value && !options?.force) {
            return {
                system_title: systemTitle.value,
                announcement_content_max_length: announcementContentMaxLength.value,
                maintenance: maintenance.value,
            }
        }
        const { data } = await getSystemSettingsApi()
        applySystemSettings(data)
        return data
    }

    const updateSystemSettings = async (payload: Partial<{ system_title: string; maintenance_enabled: boolean; maintenance_scheduled_at: string | null }>) => {
        const { data } = await updateSystemSettingsApi(payload)
        applySystemSettings(data)
        return data
    }

    const loadAnnouncements = async (options?: { force?: boolean }) => {
        if (announcementsLoaded.value && !options?.force) {
            return announcements.value
        }
        const { data } = await getSystemAnnouncementsApi()
        announcements.value = data.items || []
        announcementsLoaded.value = true
        return announcements.value
    }

    const publishAnnouncement = async (payload: { title: string; content: string }) => {
        const { data } = await createSystemAnnouncementApi(payload)
        upsertAnnouncement(data.item)
        return data.item
    }

    const markAnnouncementRead = async (announcementId: number) => {
        const { data } = await markSystemAnnouncementReadApi(announcementId)
        upsertAnnouncement(data.item)
        return data.item
    }

    const markAllAnnouncementsRead = async () => {
        await markAllSystemAnnouncementsReadApi()
        announcements.value = announcements.value.map((item) => ({
            ...item,
            is_read: true,
            read_at: item.read_at || new Date().toISOString(),
        }))
    }

    const deleteAnnouncement = async (announcementId: number) => {
        await deleteSystemAnnouncementApi(announcementId)
        removeAnnouncement(announcementId)
    }

    const ensureRealtimeSubscription = () => {
        if (unsubscribeRealtime) {
            return
        }
        const stops = [
            subscribeToRealtimeEvent('system.settings.updated', ({ payload }) => {
                const systemPayload = (payload.system || payload) as SystemSettingsPayload
                applySystemSettings(systemPayload)
            }),
            subscribeToRealtimeEvent('system.announcement.created', ({ payload }) => {
                const item = payload.announcement as SystemAnnouncementItem | undefined
                if (item) {
                    upsertAnnouncement(item)
                }
            }),
            subscribeToRealtimeEvent('system.announcement.deleted', ({ payload }) => {
                const announcementId = Number(payload.announcement_id || 0)
                if (announcementId > 0) {
                    removeAnnouncement(announcementId)
                }
            }),
        ]
        unsubscribeRealtime = () => {
            stops.forEach((stop) => stop())
            unsubscribeRealtime = null
        }
    }

    const clear = () => {
        systemTitle.value = 'Hyself 管理后台'
        announcementContentMaxLength.value = 300
        maintenance.value = { ...defaultMaintenanceState }
        announcements.value = []
        settingsLoaded.value = false
        announcementsLoaded.value = false
        unsubscribeRealtime?.()
        unsubscribeRealtime = null
    }

    return {
        systemTitle,
        announcementContentMaxLength,
        maintenance,
        announcements,
        latestAnnouncement,
        unreadCount,
        settingsLoaded,
        announcementsLoaded,
        applySystemSettings,
        loadSystemSettings,
        updateSystemSettings,
        loadAnnouncements,
        publishAnnouncement,
        markAnnouncementRead,
        markAllAnnouncementsRead,
        deleteAnnouncement,
        ensureRealtimeSubscription,
        clear,
    }
})