<template>
    <div class="game-container">
        <h1 class="score">Score: {{ score }}</h1>
        <div class="button-container">
            <button class="game-button" @click="newGame">新游戏</button>
            <button class="game-button" :disabled="history.length <= 1 || isAnimating" @click="undo">撤销</button>
        </div>

        <div class="board" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
            <div class="board-grid">
                <div v-for="cellIndex in BOARD_CELLS" :key="cellIndex" class="cell empty"></div>
            </div>

            <div
                v-for="tile in tiles"
                :key="tile.id"
                class="tile"
                :style="tileStyle(tile)"
            >
                <div class="tile-inner" :class="[`cell-${tile.value}`, { 'tile-new': tile.isNew, 'tile-merged': tile.isMerged }]">
                    {{ tile.value }}
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref } from 'vue'
import { type Game2048Tile as Tile, useGameStore } from '@/stores/game'

type Direction = 'up' | 'down' | 'left' | 'right'

interface PositionedTile {
    tile: Tile
    index: number
}

const BOARD_SIZE = 4
const TILE_SIZE = 92
const GAP_SIZE = 16
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE
const ANIMATION_MS = 180
const SWIPE_THRESHOLD = 30

const gameStore = useGameStore()
const { score, tiles, history, isAnimating, nextTileId } = storeToRefs(gameStore)
const touchStartX = ref(0)
const touchStartY = ref(0)

function cloneTiles(source: Tile[]): Tile[] {
    return source.map((tile) => ({ ...tile, isNew: false, isMerged: false }))
}

function saveSnapshot(snapshotTiles: Tile[] = tiles.value, snapshotScore: number = score.value) {
    history.value.push({
        score: snapshotScore,
        tiles: cloneTiles(snapshotTiles),
    })
}

function getCellValue(row: number, col: number): number {
    const matched = tiles.value.find((tile) => tile.row === row && tile.col === col)
    return matched?.value ?? 0
}

function emptyCells(): Array<[number, number]> {
    const result: Array<[number, number]> = []
    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
            if (getCellValue(row, col) === 0) {
                result.push([row, col])
            }
        }
    }
    return result
}

function addRandomTile(markAsNew: boolean = true): boolean {
    const available = emptyCells()
    if (available.length === 0) {
        return false
    }

    const picked = available[Math.floor(Math.random() * available.length)]
    if (!picked) {
        return false
    }

    const [row, col] = picked
    tiles.value.push({
        id: nextTileId.value += 1,
        value: Math.random() < 0.9 ? 2 : 4,
        row,
        col,
        isNew: markAsNew,
    })
    return true
}

function clearTileFlags() {
    tiles.value = tiles.value.map((tile) => ({ ...tile, isNew: false, isMerged: false }))
}

function lineCoordinates(direction: Direction, fixedIndex: number): Array<[number, number]> {
    if (direction === 'left') {
        return Array.from({ length: BOARD_SIZE }, (_, col) => [fixedIndex, col])
    }
    if (direction === 'right') {
        return Array.from({ length: BOARD_SIZE }, (_, col) => [fixedIndex, BOARD_SIZE - 1 - col])
    }
    if (direction === 'up') {
        return Array.from({ length: BOARD_SIZE }, (_, row) => [row, fixedIndex])
    }
    return Array.from({ length: BOARD_SIZE }, (_, row) => [BOARD_SIZE - 1 - row, fixedIndex])
}

function collectLine(direction: Direction, fixedIndex: number): PositionedTile[] {
    const coordinates = lineCoordinates(direction, fixedIndex)
    const positioned: PositionedTile[] = []
    coordinates.forEach(([row, col], index) => {
        const matched = tiles.value.find((tile) => tile.row === row && tile.col === col)
        if (matched) {
            positioned.push({ tile: matched, index })
        }
    })
    return positioned
}

function canMove(): boolean {
    if (tiles.value.length < BOARD_CELLS) {
        return true
    }

    for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
            const current = getCellValue(row, col)
            if (current === 0) {
                return true
            }
            if (col + 1 < BOARD_SIZE && getCellValue(row, col + 1) === current) {
                return true
            }
            if (row + 1 < BOARD_SIZE && getCellValue(row + 1, col) === current) {
                return true
            }
        }
    }

    return false
}

function finalizeAnimation(nextScore: number) {
    window.setTimeout(() => {
        clearTileFlags()
        score.value = nextScore
        saveSnapshot(tiles.value, nextScore)
        isAnimating.value = false

        if (!canMove()) {
            message.warning('Game Over')
        }
    }, ANIMATION_MS)
}

function move(direction: Direction) {
    if (isAnimating.value) {
        return
    }

    const snapshotTiles = cloneTiles(tiles.value)
    let moved = false
    let nextScore = score.value
    const consumedIds = new Set<number>()

    for (let fixedIndex = 0; fixedIndex < BOARD_SIZE; fixedIndex += 1) {
        const line = collectLine(direction, fixedIndex)
        let targetIndex = 0
        let pending: PositionedTile | null = null

        for (const current of line) {
            if (pending && pending.tile.value === current.tile.value) {
                const [targetRow, targetCol] = lineCoordinates(direction, fixedIndex)[targetIndex - 1] ?? [current.tile.row, current.tile.col]
                pending.tile.value *= 2
                pending.tile.row = targetRow
                pending.tile.col = targetCol
                pending.tile.isMerged = true
                current.tile.row = targetRow
                current.tile.col = targetCol
                consumedIds.add(current.tile.id)
                nextScore += pending.tile.value
                moved = true
                pending = null
                continue
            }

            const [targetRow, targetCol] = lineCoordinates(direction, fixedIndex)[targetIndex] ?? [current.tile.row, current.tile.col]
            if (current.tile.row !== targetRow || current.tile.col !== targetCol) {
                moved = true
            }
            current.tile.row = targetRow
            current.tile.col = targetCol
            pending = current
            targetIndex += 1
        }
    }

    if (!moved && consumedIds.size === 0) {
        tiles.value = snapshotTiles
        return
    }

    isAnimating.value = true
    tiles.value = tiles.value.filter((tile) => !consumedIds.has(tile.id))
    score.value = nextScore
    addRandomTile(true)
    finalizeAnimation(nextScore)
}

function newGame() {
    nextTileId.value = 1
    score.value = 0
    tiles.value = []
    addRandomTile(false)
    addRandomTile(false)
    clearTileFlags()
    history.value = []
    saveSnapshot(tiles.value, 0)
}

function undo() {
    if (history.value.length <= 1 || isAnimating.value) {
        return
    }

    history.value.pop()
    const previous = history.value[history.value.length - 1]
    if (!previous) {
        return
    }

    tiles.value = cloneTiles(previous.tiles)
    score.value = previous.score
}

function tileStyle(tile: Tile) {
    const offset = tile.col * (TILE_SIZE + GAP_SIZE)
    const top = tile.row * (TILE_SIZE + GAP_SIZE)
    return {
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`,
        transform: `translate(${offset}px, ${top}px)`,
    }
}

function handleKeydown(event: KeyboardEvent) {
    switch (event.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            event.preventDefault()
            move('up')
            break
        case 'arrowdown':
        case 's':
            event.preventDefault()
            move('down')
            break
        case 'arrowleft':
        case 'a':
            event.preventDefault()
            move('left')
            break
        case 'arrowright':
        case 'd':
            event.preventDefault()
            move('right')
            break
        default:
            break
    }
}

function handleTouchStart(event: TouchEvent) {
    const touch = event.changedTouches[0]
    if (!touch) {
        return
    }
    touchStartX.value = touch.clientX
    touchStartY.value = touch.clientY
}

function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0]
    if (!touch) {
        return
    }

    const deltaX = touch.clientX - touchStartX.value
    const deltaY = touch.clientY - touchStartY.value

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
        return
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        move(deltaX > 0 ? 'right' : 'left')
        return
    }
    move(deltaY > 0 ? 'down' : 'up')
}

onMounted(() => {
    if (tiles.value.length === 0 || history.value.length === 0) {
        newGame()
    }
    window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.game-container {
    --game-button-hover-border: #1677ff;
    --board-bg: color-mix(in srgb, var(--surface-header) 85%, #8f7a66 15%);
    --cell-empty-bg: rgba(205, 193, 180, 0.45);
    --tile-2-bg: #eee4da;
    --tile-2-text: #5f5246;
    --tile-4-bg: #ede0c8;
    --tile-4-text: #5b5147;
    --tile-8-bg: #f2b179;
    --tile-8-text: #f9f6f2;
    --tile-16-bg: #f59563;
    --tile-16-text: #f9f6f2;
    --tile-32-bg: #f67c5f;
    --tile-32-text: #f9f6f2;
    --tile-64-bg: #f65e3b;
    --tile-64-text: #f9f6f2;
    --tile-128-bg: #edcf72;
    --tile-128-text: #f9f6f2;
    --tile-256-bg: #edcc61;
    --tile-256-text: #f9f6f2;
    --tile-512-bg: #edc850;
    --tile-512-text: #f9f6f2;
    --tile-1024-bg: #edc53f;
    --tile-1024-text: #f9f6f2;
    --tile-2048-bg: #edc22e;
    --tile-2048-text: #f9f6f2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 20px;
}

.score {
    font-size: 2em;
    color: var(--text-primary);
    margin: 0;
}

.button-container {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.game-button {
    padding: 10px 20px;
    font-size: 1em;
    font-weight: 500;
    color: var(--text-primary);
    background-color: var(--surface-header);
    border: 1px solid color-mix(in srgb, var(--text-secondary) 30%, transparent);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.game-button:hover:not(:disabled) {
    border-color: var(--game-button-hover-border);
}

.game-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}

.board {
    position: relative;
    width: 446px;
    height: 446px;
    background-color: var(--board-bg);
    padding: 15px;
    border-radius: 12px;
    box-sizing: border-box;
    touch-action: none;
}

.board-grid {
    display: grid;
    grid-template-columns: repeat(4, 92px);
    gap: 16px;
}

.cell,
.tile,
.tile-inner {
    width: 92px;
    height: 92px;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2em;
    font-weight: bold;
}

.cell.empty {
    background-color: var(--cell-empty-bg);
}

.tile {
    position: absolute;
    top: 15px;
    left: 15px;
    transition: transform 0.18s ease-in-out;
    will-change: transform;
}

.tile-inner {
    color: var(--text-primary);
}

.tile-new {
    animation: tile-pop 0.18s ease-out;
}

.tile-merged {
    animation: tile-merge 0.22s ease-out;
}

.cell-2 { background-color: var(--tile-2-bg); color: var(--tile-2-text); }
.cell-4 { background-color: var(--tile-4-bg); color: var(--tile-4-text); }
.cell-8 { background-color: var(--tile-8-bg); color: var(--tile-8-text); }
.cell-16 { background-color: var(--tile-16-bg); color: var(--tile-16-text); }
.cell-32 { background-color: var(--tile-32-bg); color: var(--tile-32-text); }
.cell-64 { background-color: var(--tile-64-bg); color: var(--tile-64-text); }
.cell-128 { background-color: var(--tile-128-bg); color: var(--tile-128-text); font-size: 1.8em; }
.cell-256 { background-color: var(--tile-256-bg); color: var(--tile-256-text); font-size: 1.8em; }
.cell-512 { background-color: var(--tile-512-bg); color: var(--tile-512-text); font-size: 1.8em; }
.cell-1024 { background-color: var(--tile-1024-bg); color: var(--tile-1024-text); font-size: 1.5em; }
.cell-2048 { background-color: var(--tile-2048-bg); color: var(--tile-2048-text); font-size: 1.5em; }

:global(:root[data-theme='dark']) .game-container {
    --game-button-hover-border: #7fb0ff;
    --board-bg: linear-gradient(180deg, #1b2435 0%, #131b29 100%);
    --cell-empty-bg: rgba(120, 137, 168, 0.16);
    --tile-2-bg: #223249;
    --tile-2-text: #edf4ff;
    --tile-4-bg: #29405b;
    --tile-4-text: #eff5ff;
    --tile-8-bg: #315a78;
    --tile-8-text: #f4f9ff;
    --tile-16-bg: #2e6f78;
    --tile-16-text: #f3fcfb;
    --tile-32-bg: #23736f;
    --tile-32-text: #f2fffd;
    --tile-64-bg: #2f7f56;
    --tile-64-text: #f4fff8;
    --tile-128-bg: #5d8841;
    --tile-128-text: #fbffef;
    --tile-256-bg: #857233;
    --tile-256-text: #fff9eb;
    --tile-512-bg: #9a6030;
    --tile-512-text: #fff6ee;
    --tile-1024-bg: #a14837;
    --tile-1024-text: #fff1ee;
    --tile-2048-bg: #a03a5f;
    --tile-2048-text: #fff0f7;
}

@keyframes tile-pop {
    0% { transform: scale(0.7); }
    100% { transform: scale(1); }
}

@keyframes tile-merge {
    0% { transform: scale(1); }
    50% { transform: scale(1.08); }
    100% { transform: scale(1); }
}
</style>
