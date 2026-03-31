const AVATAR_MAX_BYTES = 5 * 1024 * 1024

export const trimText = (value: unknown) => String(value ?? '').trim()

export const isValidEmail = (value: string) => {
    const text = trimText(value)
    if (!text) {
        return true
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

export const isValidPhoneNumber = (value: string) => {
    const text = trimText(value)
    if (!text) {
        return true
    }
    return /^1\d{10}$/.test(text)
}

export const validateAvatarFile = (file: File) => {
    if (!String(file.type || '').startsWith('image/')) {
        return '请选择图片文件'
    }

    if (file.size > AVATAR_MAX_BYTES) {
        return '头像大小不能超过 5MB'
    }

    return ''
}
