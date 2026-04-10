<template>
    <div class="composer-surface" :class="{ disabled }" @click="focus">
        <div v-if="!hasRenderableContent" class="composer-surface__placeholder">{{ placeholder }}</div>
        <div
            ref="editorRef"
            class="composer-surface__editor"
            :contenteditable="disabled ? 'false' : 'true'"
            spellcheck="false"
            @input="handleInput"
            @keydown="handleKeydown"
            @paste="handlePaste"
        ></div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatComposerAttachmentToken, ChatComposerSegment } from '@/types/chat'
import { formatFileSize } from '@/utils/fileFormatter'

const props = defineProps<{
    disabled?: boolean
    placeholder: string
    sendHotkey: 'enter' | 'ctrl_enter'
}>()

const emit = defineEmits<{
    'typing-change': [hasContent: boolean]
    'request-submit': []
    'paste-files': [files: File[]]
}>()

export type RichMessageComposerExpose = {
    clear: () => void
    focus: () => void
    getSegments: () => ChatComposerSegment[]
    hasContent: () => boolean
    insertText: (text: string) => void
    insertAttachment: (attachment: ChatComposerAttachmentToken) => void
}

const editorRef = ref<HTMLDivElement | null>(null)
const revision = ref(0)

const hasRenderableContent = computed(() => {
    revision.value
    return getSegments().length > 0
})

const touch = () => {
    revision.value += 1
    emit('typing-change', getSegments().length > 0)
}

const focus = () => {
    if (props.disabled) {
        return
    }
    editorRef.value?.focus()
}

const createAttachmentChip = (attachment: ChatComposerAttachmentToken) => {
    const chip = document.createElement('span')
    chip.className = 'composer-attachment-chip'
    chip.setAttribute('contenteditable', 'false')
    chip.dataset.solbotAttachment = '1'
    chip.dataset.tokenId = attachment.token_id
    chip.dataset.sourceAssetReferenceId = String(attachment.source_asset_reference_id)
    chip.dataset.displayName = attachment.display_name
    chip.dataset.mediaType = attachment.media_type
    chip.dataset.mimeType = attachment.mime_type || ''
    chip.dataset.fileSize = String(attachment.file_size || '')
    chip.dataset.url = attachment.url || ''
    chip.dataset.streamUrl = attachment.stream_url || ''
    chip.dataset.thumbnailUrl = attachment.thumbnail_url || ''
    chip.dataset.processingStatus = attachment.processing_status || ''
    chip.dataset.localUploadId = attachment.local_upload_id || ''
    const mediaType = String(attachment.media_type || '').toLowerCase()
    const isImage = mediaType === 'image' && Boolean(attachment.url)
    const isVideo = mediaType === 'video' && Boolean(attachment.url)
    const previewNode = isImage
        ? `<img class="composer-attachment-chip__preview" src="${escapeHtml(attachment.url || '')}" alt="${escapeHtml(attachment.display_name)}" />`
        : isVideo
            ? `<video class="composer-attachment-chip__preview" src="${escapeHtml(attachment.url || '')}" muted playsinline preload="metadata"></video>`
            : `<span class="composer-attachment-chip__icon">${mediaType === 'video' ? 'V' : 'F'}</span>`
    chip.innerHTML = `
        ${previewNode}
        <span class="composer-attachment-chip__body">
            <span class="composer-attachment-chip__name">${escapeHtml(attachment.display_name)}</span>
            <span class="composer-attachment-chip__size">${attachment.file_size ? escapeHtml(formatFileSize(attachment.file_size)) : '大小未知'}</span>
        </span>
    `
    return chip
}

const placeCaretAfterNode = (node: Node) => {
    const selection = window.getSelection()
    if (!selection) {
        return
    }
    const range = document.createRange()
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
}

const insertNodeAtCaret = (node: Node) => {
    const editor = editorRef.value
    if (!editor) {
        return
    }
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) {
        editor.appendChild(node)
        placeCaretAfterNode(node)
        touch()
        return
    }
    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) {
        editor.appendChild(node)
        placeCaretAfterNode(node)
        touch()
        return
    }
    range.deleteContents()
    range.insertNode(node)
    placeCaretAfterNode(node)
    touch()
}

const insertTextAtCaret = (text: string) => {
    if (!text) {
        return
    }
    insertNodeAtCaret(document.createTextNode(text))
}

const insertAttachment = (attachment: ChatComposerAttachmentToken) => {
    const chip = createAttachmentChip(attachment)
    insertNodeAtCaret(chip)
    insertNodeAtCaret(document.createTextNode(' '))
}

const insertText = (text: string) => {
    insertTextAtCaret(text)
}

const clear = () => {
    if (!editorRef.value) {
        return
    }
    editorRef.value.innerHTML = ''
    touch()
}

const readAttachmentFromElement = (element: HTMLElement): ChatComposerAttachmentToken | null => {
    if (element.dataset.solbotAttachment !== '1') {
        return null
    }
    const sourceAssetReferenceId = Number(element.dataset.sourceAssetReferenceId || 0)
    const localUploadId = String(element.dataset.localUploadId || '')
    if (!sourceAssetReferenceId && !localUploadId) {
        return null
    }
    return {
        token_id: element.dataset.tokenId || `attachment_${Date.now()}`,
        source_asset_reference_id: sourceAssetReferenceId || undefined,
        display_name: element.dataset.displayName || '附件',
        media_type: element.dataset.mediaType || 'file',
        mime_type: element.dataset.mimeType || '',
        file_size: Number(element.dataset.fileSize || 0) || undefined,
        url: element.dataset.url || '',
        stream_url: element.dataset.streamUrl || '',
        thumbnail_url: element.dataset.thumbnailUrl || '',
        processing_status: element.dataset.processingStatus || '',
        local_upload_id: localUploadId || undefined,
    }
}

const collectSegments = (node: Node, parts: ChatComposerSegment[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
        parts.push({ kind: 'text', text: node.textContent || '' })
        return
    }
    if (!(node instanceof HTMLElement)) {
        return
    }
    const attachment = readAttachmentFromElement(node)
    if (attachment) {
        parts.push({ kind: 'attachment', attachment })
        return
    }
    if (node.tagName === 'BR') {
        parts.push({ kind: 'text', text: '\n' })
        return
    }
    for (const child of Array.from(node.childNodes)) {
        collectSegments(child, parts)
    }
    if (['DIV', 'P'].includes(node.tagName)) {
        parts.push({ kind: 'text', text: '\n' })
    }
}

const getSegments = (): ChatComposerSegment[] => {
    const editor = editorRef.value
    if (!editor) {
        return []
    }
    const rawParts: ChatComposerSegment[] = []
    for (const child of Array.from(editor.childNodes)) {
        collectSegments(child, rawParts)
    }
    const merged: ChatComposerSegment[] = []
    let textBuffer = ''
    const flushText = () => {
        const normalized = textBuffer.replace(/\u00a0/g, ' ').trim()
        if (normalized) {
            merged.push({ kind: 'text', text: normalized })
        }
        textBuffer = ''
    }
    for (const part of rawParts) {
        if (part.kind === 'text') {
            textBuffer += part.text
            continue
        }
        flushText()
        merged.push(part)
    }
    flushText()
    return merged
}

const extractAttachmentNodesFromHtml = (html: string): ChatComposerAttachmentToken[] => {
    const container = document.createElement('div')
    container.innerHTML = html
    return Array.from(container.querySelectorAll<HTMLElement>('[data-solbot-attachment="1"]'))
        .map((element) => readAttachmentFromElement(element))
        .filter((item): item is ChatComposerAttachmentToken => Boolean(item))
}

const handlePaste = (event: ClipboardEvent) => {
    if (props.disabled) {
        event.preventDefault()
        return
    }
    const clipboardItems = Array.from(event.clipboardData?.items || [])
    const pastedFiles = clipboardItems
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
        .filter((file) => /^image\/|^video\//.test(String(file.type || '')))
    if (pastedFiles.length) {
        event.preventDefault()
        emit('paste-files', pastedFiles)
        return
    }
    const html = event.clipboardData?.getData('text/html') || ''
    const attachments = html ? extractAttachmentNodesFromHtml(html) : []
    if (attachments.length) {
        event.preventDefault()
        for (const attachment of attachments) {
            insertAttachment(attachment)
        }
        return
    }
    const plainText = event.clipboardData?.getData('text/plain') || ''
    if (plainText) {
        event.preventDefault()
        insertTextAtCaret(plainText)
    }
}

const handleInput = () => {
    touch()
}

const handleKeydown = (event: KeyboardEvent) => {
    if (props.disabled) {
        event.preventDefault()
        return
    }
    if (props.sendHotkey === 'enter') {
        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            emit('request-submit')
        }
        return
    }
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        emit('request-submit')
    }
}

defineExpose<RichMessageComposerExpose>({
    clear,
    focus,
    getSegments,
    hasContent: () => getSegments().length > 0,
    insertText,
    insertAttachment,
})

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}
</script>

<style scoped>
.composer-surface {
    position: relative;
    min-height: 112px;
    height: 100%;
    padding: 8px 10px;
    border: 1px solid var(--chat-panel-border);
    border-radius: 12px;
    background: var(--chat-panel-bg-strong);
    overflow: auto;
    cursor: text;
}

.composer-surface.disabled {
    opacity: 0.72;
    cursor: not-allowed;
}

.composer-surface.disabled .composer-surface__editor {
    pointer-events: none;
    user-select: none;
}

.composer-surface__placeholder {
    position: absolute;
    top: 8px;
    left: 10px;
    color: var(--chat-text-secondary);
    pointer-events: none;
}

.composer-surface__editor {
    min-height: 100%;
    outline: none;
    writing-mode: horizontal-tb;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.composer-surface__editor :deep(.composer-attachment-chip) {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 2px 4px 2px 0;
    padding: 8px 10px;
    border-radius: 12px;
    background: #eef1f4;
    color: #2f3945;
    box-shadow: inset 0 0 0 1px rgba(47, 57, 69, 0.08);
    vertical-align: middle;
}

.composer-surface__editor :deep(.composer-attachment-chip__icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(47, 57, 69, 0.1);
}

.composer-surface__editor :deep(.composer-attachment-chip__preview) {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    object-fit: cover;
    background: rgba(47, 57, 69, 0.08);
    flex: 0 0 44px;
}

.composer-surface__editor :deep(.composer-attachment-chip__body) {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    vertical-align: middle;
}

.composer-surface__editor :deep(.composer-attachment-chip__name) {
    font-weight: 600;
    color: #2f3945;
}

.composer-surface__editor :deep(.composer-attachment-chip__size) {
    font-size: 12px;
    color: rgba(47, 57, 69, 0.62);
}
</style>