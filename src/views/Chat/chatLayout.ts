export type ChatMobileTab = 'messages' | 'contacts' | 'settings'

const MOBILE_DEVICE_UA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

export const CHAT_MOBILE_ROUTE = {
    messagesList: 'ChatMessagesMobile',
    messagesDetail: 'ChatMessagesMobileDetail',
    contactsList: 'ChatContactsMobile',
    contactsFriendNotices: 'ChatContactsFriendNoticesMobile',
    contactsNotices: 'ChatContactsNoticesMobile',
    settingsList: 'ChatSettingsMobile',
    settingsShortcuts: 'ChatSettingsShortcutsMobile',
    settingsInspect: 'ChatSettingsInspectMobile',
} as const

const CHAT_MOBILE_ROUTE_NAME_SET = new Set<string>(Object.values(CHAT_MOBILE_ROUTE))

export const isMobileChatDevice = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false
    }
    const shortSide = Math.min(window.innerWidth, window.innerHeight)
    const hasTouch = navigator.maxTouchPoints > 0
    return MOBILE_DEVICE_UA.test(navigator.userAgent) || (hasTouch && shortSide <= 900)
}

export const isMobileChatRouteName = (name: unknown) => {
    if (typeof name !== 'string') {
        return false
    }
    return CHAT_MOBILE_ROUTE_NAME_SET.has(name)
}

export const isMessageListRouteName = (name: unknown) =>
    name === 'ChatMessages' || name === CHAT_MOBILE_ROUTE.messagesList

export const isMessageDetailRouteName = (name: unknown) =>
    name === CHAT_MOBILE_ROUTE.messagesDetail

export const isMessageRouteName = (name: unknown) =>
    isMessageListRouteName(name) || isMessageDetailRouteName(name)

export const resolveMessagesRouteName = (detail: boolean) => {
    if (!isMobileChatDevice()) {
        return 'ChatMessages'
    }
    return detail ? CHAT_MOBILE_ROUTE.messagesDetail : CHAT_MOBILE_ROUTE.messagesList
}

export const resolveContactsListRouteName = () =>
    isMobileChatDevice() ? CHAT_MOBILE_ROUTE.contactsList : 'ChatContactsFriendNotices'

export const resolveSettingsListRouteName = () =>
    isMobileChatDevice() ? CHAT_MOBILE_ROUTE.settingsList : 'ChatSettingsShortcuts'
