<template>
    <a-empty description="文件上传已合并到资源中心，正在跳转..." />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
    void router.replace({ path: '/file-manage', query: { tab: 'upload' } })
})
</script>