export const isMessageListRouteName = (name: unknown) =>
    name === 'ChatMessages'

export const isMessageDetailRouteName = (_name: unknown) => false

export const isMessageRouteName = (name: unknown) =>
    isMessageListRouteName(name)

export const resolveMessagesRouteName = (_detail: boolean) => 'ChatMessages'

export const resolveContactsListRouteName = () => 'ChatContactsFriendNotices'

export const resolveSettingsListRouteName = () => 'ChatSettingsShortcuts'
