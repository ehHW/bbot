import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AudioTrack {
    id: number
    title: string
    artist?: string
    coverUrl?: string
    m4aUrl: string
    lrcUrl?: string
    sourceUrl?: string
}

export interface LyricLine {
    time: number
    text: string
}

export const useGlobalAudioStore = defineStore('globalAudio', () => {
    const playlist = ref<AudioTrack[]>([])
    const currentIndex = ref<number>(-1)
    const isPlaying = ref(false)
    const currentTime = ref(0)
    const duration = ref(0)
    const controlAction = ref<'play' | 'pause' | 'toggle' | 'none'>('none')
    const controlSeq = ref(0)

    // Default empty lyric array
    const currentLyrics = ref<LyricLine[]>([])

    const currentTrack = computed(() => {
        if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
            return playlist.value[currentIndex.value]
        }
        return null
    })

    const currentLyricText = computed(() => {
        if (!currentLyrics.value.length) return '暂无歌词'
        // Find the deepest lyric line whose time is <= currentTime
        // Assuming currentLyrics is sorted by time ascending
        const firstLine = currentLyrics.value[0]
        if (!firstLine) {
            return '暂无歌词'
        }
        let activeLine = firstLine
        for (let i = 0; i < currentLyrics.value.length; i++) {
            const lyricLine = currentLyrics.value[i]
            if (!lyricLine) {
                continue
            }
            if (lyricLine.time <= currentTime.value) {
                activeLine = lyricLine
            } else {
                break
            }
        }
        return activeLine.text || '...'
    })

    const playTrack = (track: AudioTrack) => {
        const index = playlist.value.findIndex(t => t.id === track.id)
        if (index >= 0) {
            playlist.value[index] = track
            currentIndex.value = index
        } else {
            playlist.value.push(track)
            currentIndex.value = playlist.value.length - 1
        }
        currentTime.value = 0
        loadLyricsForCurrentTrack()
    }

    const emitControl = (action: 'play' | 'pause' | 'toggle') => {
        controlAction.value = action
        controlSeq.value += 1
    }

    const requestPlayTrack = (track: AudioTrack) => {
        playTrack(track)
        emitControl('play')
    }

    const requestPause = () => {
        emitControl('pause')
    }

    const requestToggle = () => {
        emitControl('toggle')
    }

    const isCurrentTrack = (trackId: number) => {
        return Number(currentTrack.value?.id || 0) === Number(trackId || 0)
    }

    const nextTrack = () => {
        if (!playlist.value.length) return
        currentIndex.value = (currentIndex.value + 1) % playlist.value.length
        loadLyricsForCurrentTrack()
    }

    const prevTrack = () => {
        if (!playlist.value.length) return
        currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
        loadLyricsForCurrentTrack()
    }

    const parseLrc = (lrcString: string): LyricLine[] => {
        const lines = lrcString.split('\n')
        const lyrics: LyricLine[] = []
        const timeExp = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/
        for (const line of lines) {
            const match = timeExp.exec(line)
            if (match) {
                const minsText = match[1]
                const secsText = match[2]
                const lyricText = match[3]
                if (!minsText || !secsText || lyricText == null) {
                    continue
                }
                const mins = parseInt(minsText, 10)
                const secs = parseFloat(secsText)
                const text = lyricText.trim()
                lyrics.push({ time: mins * 60 + secs, text })
            }
        }
        return lyrics.sort((a, b) => a.time - b.time)
    }

    const loadLyricsForCurrentTrack = async () => {
        currentLyrics.value = []
        const track = currentTrack.value
        const lrcUrl = track?.lrcUrl
        if (!track || !lrcUrl) return
        try {
            const res = await fetch(lrcUrl)
            if (res.ok) {
                const lrcText = await res.text()
                currentLyrics.value = parseLrc(lrcText)
            }
        } catch (e) {
            console.error('Failed to load lyrics', e)
        }
    }

    return {
        playlist,
        currentIndex,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        controlAction,
        controlSeq,
        currentLyrics,
        currentLyricText,
        playTrack,
        requestPlayTrack,
        requestPause,
        requestToggle,
        isCurrentTrack,
        nextTrack,
        prevTrack,
        parseLrc,
    }
})