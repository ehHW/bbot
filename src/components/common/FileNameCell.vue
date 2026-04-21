<template>
    <span class="file-name-cell">
        <img v-if="previewImageUrl" :src="previewImageUrl" :alt="name" class="file-preview-md" />
        <img v-else :src="iconUrl" :alt="name" class="file-icon-md" />
        <a v-if="clickable" @click="onClick">{{ name }}</a>
        <span v-else>{{ name }}</span>
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AssetPreviewModel } from '@/types/assets'
import { getIconUrl } from '@/utils/iconMapper'

const props = withDefaults(
    defineProps<{
        name: string
        isDir: boolean
        clickable?: boolean
        preview?: AssetPreviewModel | null
    }>(),
    {
        clickable: false,
        preview: null,
    },
)

const emit = defineEmits<{
    (e: 'click'): void
}>()

const resolvedIsDir = computed(() => props.isDir || Boolean(props.preview?.isDirectory))

const iconUrl = computed(() => getIconUrl(props.name, resolvedIsDir.value))

const previewImageUrl = computed(() => {
    if (resolvedIsDir.value || !props.preview) {
        return ''
    }

    const mediaType = String(props.preview.mediaType || '').trim().toLowerCase()
    if (mediaType === 'image' && props.preview.url) {
        return props.preview.url
    }
    if (mediaType === 'video' && props.preview.thumbnailUrl) {
        return props.preview.thumbnailUrl
    }
    return ''
})

const onClick = () => {
    if (!props.clickable) {
        return
    }
    emit('click')
}
</script>

<style scoped>
.file-name-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.file-preview-md {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
}
</style>
