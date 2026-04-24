export interface SystemMaintenanceState {
    enabled: boolean
    scheduled_at: string | null
    activated_at: string | null
    is_active: boolean
}

export interface SystemSettingsPayload {
    system_title: string
    announcement_content_max_length: number
    maintenance: SystemMaintenanceState
}

export interface SystemAnnouncementItem {
    id: number
    title: string
    content: string
    published_at: string | null
    published_by: string
    is_read: boolean
    read_at: string | null
}