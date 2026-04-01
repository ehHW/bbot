import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Game2048Tile {
    id: number
    value: number
    row: number
    col: number
    isNew?: boolean
    isMerged?: boolean
}

export interface Game2048HistoryItem {
    score: number
    tiles: Game2048Tile[]
}

export const useGameStore = defineStore('game', () => {
    const score = ref(0)
    const tiles = ref<Game2048Tile[]>([])
    const history = ref<Game2048HistoryItem[]>([])
    const isAnimating = ref(false)
    const nextTileId = ref(1)

    return {
        score,
        tiles,
        history,
        isAnimating,
        nextTileId,
    }
})
