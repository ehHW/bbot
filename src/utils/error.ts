export const getErrorMessage = (error: unknown, fallback = '操作失败') => {
    const maybeError = error as {
        response?: { data?: Record<string, any> | string; status?: number }
        message?: string
    }

    const responseData = maybeError?.response?.data
    const statusCode = Number(maybeError?.response?.status || 0)
    if (typeof responseData === 'string') {
        const looksLikeHtml = /<\s*html|<\s*!doctype\s+html/i.test(responseData)
        if (looksLikeHtml) {
            if (statusCode === 404) {
                return '请求地址不存在，请刷新页面后重试'
            }
            return fallback
        }
        return responseData
    }

    if (responseData && typeof responseData === 'object') {
        // 处理detail字段
        if ('detail' in responseData && typeof responseData.detail === 'string') {
            return responseData.detail
        }
        // 处理message字段
        if ('message' in responseData && typeof responseData.message === 'string') {
            return responseData.message
        }
        // 处理Django REST Framework的字段错误（如non_field_errors）
        if ('non_field_errors' in responseData && Array.isArray(responseData.non_field_errors)) {
            const errors = responseData.non_field_errors as any[]
            if (errors.length > 0) {
                const firstError = errors[0]
                return typeof firstError === 'string' ? firstError : String(firstError)
            }
        }
        // 处理其他字段的第一个错误
        for (const key in responseData) {
            if (Array.isArray(responseData[key])) {
                const errors = responseData[key] as any[]
                if (errors.length > 0) {
                    const firstError = errors[0]
                    return typeof firstError === 'string' ? firstError : String(firstError)
                }
            }
        }
    }

    return maybeError?.message || fallback
}
