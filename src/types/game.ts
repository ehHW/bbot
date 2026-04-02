export interface GameRecordItem {
    id: number
    user_id: number
    username: string
    display_name: string
    avatar: string
    game_code: string
    game_name: string
    best_score: number
    board_snapshot: number[][]
    finished_at: string
    rank?: number
}

export interface GameLeaderboardResponse {
    game_code: string
    limit: number
    results: GameRecordItem[]
}

export interface MyGameBestRecordResponse {
    record: GameRecordItem | null
}

export interface SubmitBestRecordResponse {
    updated: boolean
    previous_best_score: number
    record: GameRecordItem
}