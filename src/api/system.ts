import instance from '@/utils/request'
import type { SystemAnnouncementItem, SystemSettingsPayload } from '@/types/system'

export const getSystemSettingsApi = () => {
    return instance.get<SystemSettingsPayload>('system/settings/')
}

export const updateSystemSettingsApi = (payload: Partial<{ system_title: string; maintenance_enabled: boolean; maintenance_scheduled_at: string | null }>) => {
    return instance.patch<SystemSettingsPayload>('system/settings/', payload)
}

export const getSystemAnnouncementsApi = () => {
    return instance.get<{ items: SystemAnnouncementItem[] }>('system/announcements/')
}

export const createSystemAnnouncementApi = (payload: { title: string; content: string }) => {
    return instance.post<{ detail: string; item: SystemAnnouncementItem }>('system/announcements/', payload)
}

export const markSystemAnnouncementReadApi = (announcementId: number) => {
    return instance.post<{ detail: string; item: SystemAnnouncementItem }>(`system/announcements/${announcementId}/read/`)
}

export const markAllSystemAnnouncementsReadApi = () => {
    return instance.post<{ detail: string; updated_count: number }>('system/announcements/read-all/')
}

export const deleteSystemAnnouncementApi = (announcementId: number) => {
    return instance.delete<{ detail: string }>(`system/announcements/${announcementId}/`)
}