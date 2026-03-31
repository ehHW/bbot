export const formatFileSize = (size: number) => {
    const mb = size / 1024 / 1024
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`
    }
    if (mb >= 1) {
        return `${mb.toFixed(2)} MB`
    }
    return `${(size / 1024).toFixed(2)} KB`
}
