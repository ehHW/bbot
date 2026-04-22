<template>
    <div class="global-audio-player">
        <!-- Avatar Area -->
        <div class="audio-avatar-cell">
            <a-avatar
                :src="store.currentTrack?.coverUrl"
                :size="28"
                class="audio-avatar"
                :class="{ 'is-playing': store.isPlaying }"
            >
                <CustomerServiceOutlined />
            </a-avatar>
        </div>

        <!-- Middle Area (Lyric + Progress) -->
        <div class="audio-middle-cell">
            <div class="audio-lyric-row">
                <span class="lyric-text" :title="store.currentLyricText">
                    {{ store.currentLyricText }}
                </span>
            </div>
            <div class="audio-progress-row">
                <!-- Native audio element to be wrapped by plyr -->
                <audio ref="audioRef" controls>
                    <source
                        :src="store.currentTrack?.m4aUrl || ''"
                        type="audio/mp4"
                    />
                </audio>
            </div>
        </div>

        <!-- Extra Controls Area -->
        <div class="audio-ext-controls">
            <a-button
                type="text"
                shape="circle"
                class="ext-btn"
                :disabled="!store.currentTrack"
                @click="store.prevTrack"
            >
                <template #icon><StepBackwardOutlined /></template>
            </a-button>
            <a-button
                type="text"
                shape="circle"
                class="ext-btn play-btn"
                :disabled="!store.currentTrack"
                @click="togglePlay"
            >
                <template #icon>
                    <PauseCircleFilled v-if="store.isPlaying" />
                    <PlayCircleFilled v-else />
                </template>
            </a-button>
            <a-button
                type="text"
                shape="circle"
                class="ext-btn"
                :disabled="!store.currentTrack"
                @click="store.nextTrack"
            >
                <template #icon><StepForwardOutlined /></template>
            </a-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from "vue";
import {
    CustomerServiceOutlined,
    StepBackwardOutlined,
    StepForwardOutlined,
    PlayCircleFilled,
    PauseCircleFilled,
} from "@ant-design/icons-vue";
// @ts-ignore
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { useGlobalAudioStore } from "@/stores/globalAudio";

type PlyrPlayerSource = {
    type: string;
    sources: Array<{
        src: string;
        type: string;
    }>;
};

type PlyrPlayerInstance = {
    play: () => void | Promise<void>;
    pause: () => void;
    destroy: () => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    source: PlyrPlayerSource;
    currentTime: number;
    duration: number;
};

type PlyrPlayerConstructor = new (
    element: HTMLAudioElement,
    options: {
        controls: string[];
        hideControls: boolean;
    },
) => PlyrPlayerInstance;

const PlyrConstructor = Plyr as unknown as PlyrPlayerConstructor;

const store = useGlobalAudioStore();
const audioRef = ref<HTMLAudioElement | null>(null);
let player: PlyrPlayerInstance | null = null;
const currentAudioSource = computed(() => store.currentTrack?.m4aUrl || "");

const togglePlay = () => {
    if (!player) return;
    if (store.isPlaying) {
        player.pause();
    } else {
        player.play();
    }
};

onMounted(() => {
    if (audioRef.value) {
        player = new PlyrConstructor(audioRef.value, {
            controls: ["progress", "current-time", "duration"],
            hideControls: false,
        });

        player.on("playing", () => {
            store.isPlaying = true;
        });
        player.on("pause", () => {
            store.isPlaying = false;
        });
        player.on("timeupdate", () => {
            store.currentTime = player?.currentTime || 0;
        });
        player.on("ended", () => {
            store.isPlaying = false;
            store.nextTrack();
        });
        player.on("loadedmetadata", () => {
            store.duration = player?.duration || 0;
        });
    }
});

watch(
    () => store.currentTrack,
    (newTrack) => {
        if (newTrack && player) {
            player.source = {
                type: "audio",
                sources: [
                    {
                        src: newTrack.m4aUrl,
                        type: "audio/mp4",
                    },
                ],
            };
            const playResult = player.play();
            if (playResult && typeof playResult.then === "function") {
                playResult.catch((error: unknown) =>
                    console.warn("Auto-play prevented:", error),
                );
            }
        }
    },
    { deep: true },
);

watch(
    () => currentAudioSource.value,
    (sourceUrl) => {
        if (!sourceUrl || !player) {
            return;
        }
        store.currentTime = 0;
    },
);

watch(
    () => store.controlSeq,
    () => {
        if (!player) {
            return;
        }
        const action = store.controlAction;
        if (action === "pause") {
            player.pause();
            return;
        }
        if (action === "play") {
            const playResult = player.play();
            if (playResult && typeof playResult.then === "function") {
                playResult.catch(() => undefined);
            }
            return;
        }
        if (action === "toggle") {
            if (store.isPlaying) {
                player.pause();
            } else {
                const playResult = player.play();
                if (playResult && typeof playResult.then === "function") {
                    playResult.catch(() => undefined);
                }
            }
        }
    },
);

onBeforeUnmount(() => {
    if (player) {
        player.destroy();
        player = null;
    }
});
</script>

<style scoped>
.global-audio-player {
    display: flex;
    align-items: center;
    border-radius: 12px;
    background: color-mix(
        in srgb,
        var(--surface-header) 78%,
        var(--surface-sidebar) 22%
    );
    border: 1px solid color-mix(in srgb, var(--text-secondary) 18%, transparent);
    padding: 2px 5px 2px 2px;
    height: 42px;
    gap: 6px;
    width: 360px;
    min-width: 360px;
    max-width: 360px;
    margin-block: 4px;
    margin-right: 8px;
    overflow: hidden;
    box-sizing: border-box;
}

/* Avatar */
.audio-avatar-cell {
    flex-shrink: 0;
}
.audio-avatar {
    background-color: color-mix(
        in srgb,
        var(--surface-sidebar) 70%,
        var(--surface-header) 30%
    );
    color: var(--text-primary);
    transition: transform 0.2s;
}
.audio-avatar.is-playing {
    animation: spin 10s linear infinite;
}
@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* Middle (Lyrics & Progress) */
.audio-middle-cell {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    justify-content: flex-end;
    gap: 2px;
}

.audio-lyric-row {
    font-size: 10px;
    color: var(--text-secondary);
    padding-inline: 0 54px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
    text-align: center;
}

.audio-progress-row {
    height: 14px;
    display: flex;
    align-items: center;
}

/* Force Plyr to be slim and remove paddings */
::v-deep(.plyr) {
    width: 100%;
    min-width: 100%;
}
::v-deep(.plyr__controls) {
    padding: 0 !important;
    background: transparent !important;
    min-height: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    color: var(--text-primary);
}
::v-deep(.plyr__progress__container) {
    flex: 1;
    margin: 0 3px !important;
}
::v-deep(.plyr__time) {
    font-size: 10px !important;
    padding: 0 !important;
    min-width: 28px;
    text-align: center;
}
::v-deep(.plyr__time + .plyr__time) {
    margin-left: 0 !important;
}
::v-deep(.plyr__time + .plyr__time::before) {
    margin-inline: 1px !important;
}
::v-deep(.plyr--audio .plyr__controls) {
    color: var(--text-primary) !important;
}
::v-deep(.plyr) {
    --plyr-range-track-height: 3px;
    --plyr-range-thumb-height: 8px;
    --plyr-range-thumb-background: var(--ant-color-primary, #1677ff);
}
::v-deep(.plyr__progress input[type="range"]) {
    height: 8px;
}
::v-deep(.plyr__progress input[type="range"]::-webkit-slider-thumb) {
    height: 8px;
    width: 8px;
    margin-top: -2.5px;
}
::v-deep(.plyr__progress input[type="range"]::-moz-range-thumb) {
    height: 8px;
    width: 8px;
}

/* Extra Controls */
.audio-ext-controls {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
}
.ext-btn {
    color: var(--ant-color-primary, #3489d7) !important;
    width: 20px;
    min-width: 20px;
    height: 20px;
    padding: 0;
}
.ext-btn :deep(.anticon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}
.ext-btn:hover {
    color: var(--ant-color-primary, #5ba9e8);
    background: color-mix(
        in srgb,
        var(--ant-color-primary, #5ba9e8) 12%,
        transparent
    );
}
.play-btn {
    font-size: 16px;
}
.play-btn :deep(.anticon) {
    transform: translateY(-1px);
}

@media (max-width: 1280px) {
    .global-audio-player {
        width: 360px;
        min-width: 360px;
        max-width: 360px;
    }
}

@media (max-width: 1024px) {
    .global-audio-player {
        width: 360px;
        min-width: 360px;
        max-width: 360px;
    }
}

:global(html.chat-device--mobile) .global-audio-player {
    width: 100%;
    min-width: 0;
    max-width: none;
    margin-right: 0;
}

@media (max-width: 900px) {
    .global-audio-player {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        margin-right: 0 !important;
    }
}
</style>
