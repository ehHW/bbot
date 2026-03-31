/**
 * 时间格式化工具
 */

/**
 * 格式化时间为相对时间（如"2小时前"）或绝对时间
 * @param dateStr - ISO 8601 格式的时间字符串或Date对象
 * @param showAbsolute - 是否在相对时间后显示绝对时间
 * @returns 格式化后的时间字符串
 */
export function formatRelativeTime(dateStr: string | Date, showAbsolute: boolean = false): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffSeconds = Math.floor(diffMs / 1000)
        const diffMinutes = Math.floor(diffSeconds / 60)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        let relativeText = ''

        if (diffSeconds < 60) {
            relativeText = '刚刚'
        } else if (diffMinutes < 60) {
            relativeText = `${diffMinutes}分钟前`
        } else if (diffHours < 24) {
            relativeText = `${diffHours}小时前`
        } else if (diffDays < 7) {
            relativeText = `${diffDays}天前`
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7)
            relativeText = `${weeks}周前`
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30)
            relativeText = `${months}个月前`
        } else {
            const years = Math.floor(diffDays / 365)
            relativeText = `${years}年前`
        }

        if (showAbsolute) {
            const absoluteTime = formatDateTime(date)
            return `${relativeText} (${absoluteTime})`
        }

        return relativeText
    } catch (error) {
        return '未知时间'
    }
}

/**
 * 格式化时间为 "YYYY-MM-DD HH:mm:ss" 格式
 * @param dateStr - ISO 8601 格式的时间字符串或Date对象
 * @returns 格式化后的时间字符串
 */
export function formatDateTime(dateStr: string | Date): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    } catch (error) {
        return '未知时间'
    }
}

/**
 * 格式化时间为 "YYYY-MM-DD" 格式
 * @param dateStr - ISO 8601 格式的时间字符串或Date对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(dateStr: string | Date): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        return `${year}-${month}-${day}`
    } catch (error) {
        return '未知日期'
    }
}

/**
 * 格式化时间为 "HH:mm:ss" 格式
 * @param dateStr - ISO 8601 格式的时间字符串或Date对象
 * @returns 格式化后的时间字符串
 */
export function formatTime(dateStr: string | Date): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')

        return `${hours}:${minutes}:${seconds}`
    } catch (error) {
        return '未知时间'
    }
}

/**
 * 智能时间格式化 - 同一天显示时间，不同天显示日期+时间
 * @param dateStr - ISO 8601 格式的时间字符串或Date对象
 * @returns 格式化后的时间字符串
 */
export function formatSmartTime(dateStr: string | Date): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
        const now = new Date()

        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        if (dateOnly.getTime() === nowOnly.getTime()) {
            // 同一天，只显示时间
            return formatTime(date)
        } else {
            // 不同天，显示日期+时间
            return formatDateTime(date)
        }
    } catch (error) {
        return '未知时间'
    }
}
