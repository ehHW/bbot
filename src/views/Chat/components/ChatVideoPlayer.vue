<template>
    <div class="chat-video-player">
        <video ref="videoRef" class="chat-video-player__element" playsinline preload="metadata" :poster="resolvedPosterUrl || undefined"></video>
    </div>
</template>

<script setup lang="ts">
import Hls from 'hls.js'
import Plyr from 'plyr';
import 'plyr/dist/plyr.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
    sourceUrl?: string
    streamUrl?: string
    posterUrl?: string
    autoplay?: boolean
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const localPosterUrl = ref('')
const resolvedPosterUrl = computed(() => localPosterUrl.value || String(props.posterUrl || '').trim())
let hls: Hls | null = null
let player: Plyr | null = null
let currentSourceUrl = ''

const revokeLocalPosterUrl = () => {
    localPosterUrl.value = ''
}

const destroyPlayer = () => {
    hls?.destroy()
    hls = null
    player?.destroy()
    player = null
}

const resolveVideoSource = () => {
    const streamUrl = String(props.streamUrl || '').trim()
    if (streamUrl) {
        return streamUrl
    }
    return String(props.sourceUrl || '').trim()
}

const capturePosterFromFrame = () => {
    const element = videoRef.value
    if (!element || localPosterUrl.value) {
        return
    }
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !element.videoWidth || !element.videoHeight) {
        return
    }
    try {
        const canvas = document.createElement('canvas')
        canvas.width = element.videoWidth
        canvas.height = element.videoHeight
        const context = canvas.getContext('2d')
        if (!context) {
            return
        }
        context.drawImage(element, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
        if (dataUrl && dataUrl !== 'data:,') {
            localPosterUrl.value = dataUrl
            applyPoster()
        }
    } catch {
        // Ignore poster capture failures and fall back to plain video rendering.
    }
}

const ensurePlayer = (element: HTMLVideoElement) => {
    if (player) {
        return
    }
    player = new Plyr(element, {
        autoplay: props.autoplay ?? false,
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
    })
}

const applyPoster = () => {
    const element = videoRef.value
    if (!element) {
        return
    }
    if (resolvedPosterUrl.value) {
        element.poster = resolvedPosterUrl.value
        return
    }
    element.removeAttribute('poster')
}

const mountPlayer = () => {
    const element = videoRef.value
    if (!element) {
        return
    }
    const sourceUrl = resolveVideoSource()
    revokeLocalPosterUrl()
    applyPoster()
    if (!sourceUrl) {
        hls?.destroy()
        hls = null
        currentSourceUrl = ''
        element.pause()
        element.removeAttribute('src')
        element.load()
        return
    }

    if (sourceUrl === currentSourceUrl && player) {
        return
    }

    currentSourceUrl = sourceUrl
    hls?.destroy()
    hls = null
    element.pause()
    element.removeAttribute('src')

    if (sourceUrl.endsWith('.m3u8') && Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
        })
        hls.attachMedia(element)
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls?.loadSource(sourceUrl)
        })
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
            capturePosterFromFrame()
        })
    } else {
        element.src = sourceUrl
        element.load()
    }
    ensurePlayer(element)
}

watch(
    () => [props.sourceUrl, props.streamUrl],
    () => {
        mountPlayer()
    },
)

watch(
    () => props.posterUrl,
    () => {
        applyPoster()
    },
)

onMounted(() => {
    videoRef.value?.addEventListener('loadeddata', capturePosterFromFrame)
    mountPlayer()
})

onBeforeUnmount(() => {
    videoRef.value?.removeEventListener('loadeddata', capturePosterFromFrame)
    currentSourceUrl = ''
    revokeLocalPosterUrl()
    destroyPlayer()
})
</script>

<style scoped>
.chat-video-player,
.chat-video-player__element {
    width: 100%;
}

.chat-video-player__element {
    display: block;
    max-height: min(72vh, 720px);
    border-radius: 10px;
    background: #0f172a;
}

:deep(.plyr--video) {
    margin-top: -2px;
}
</style>