import instance from '@/utils/request'
import type { GameLeaderboardResponse, MyGameBestRecordResponse, SubmitBestRecordResponse } from '@/types/game'

export const getGameLeaderboardApi = (params: { game_code: string; limit?: number }) => {
    return instance.get<GameLeaderboardResponse>('game/leaderboard/', { params })
}

export const getMyBestGameRecordApi = (params: { game_code: string }) => {
    return instance.get<MyGameBestRecordResponse>('game/records/my-best/', { params })
}

export const submitBestGameRecordApi = (payload: {
    game_code: string
    game_name?: string
    score: number
    board_snapshot: number[][]
}) => {
    return instance.post<SubmitBestRecordResponse>('game/records/submit-best/', payload)
}