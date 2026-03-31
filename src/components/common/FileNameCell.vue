<template>
    <span class="file-name-cell">
        <img :src="getIconUrl(name, isDir)" :alt="name" class="file-icon-md" />
        <a v-if="clickable" @click="onClick">{{ name }}</a>
        <span v-else>{{ name }}</span>
    </span>
</template>

<script setup lang="ts">
import { getIconUrl } from '@/utils/iconMapper'

const props = withDefaults(
    defineProps<{
        name: string
        isDir: boolean
        clickable?: boolean
    }>(),
    {
        clickable: false,
    },
)

const emit = defineEmits<{
    (e: 'click'): void
}>()

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
</style>
