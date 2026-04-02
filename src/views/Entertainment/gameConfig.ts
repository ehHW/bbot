export interface EntertainmentGameConfig {
    code: string
    name: string
}

export const ENTERTAINMENT_GAMES = {
    game2048: {
        code: '2048',
        name: '2048',
    },
} as const satisfies Record<string, EntertainmentGameConfig>
