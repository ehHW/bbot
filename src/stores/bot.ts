import { defineStore } from 'pinia'
import { qwe } from '@/api/bot'

export const useBotStore = defineStore('bot', () => {
    const qwe2 = async () => {
        const res = await qwe()
        console.log(res)
    }

    return { qwe2 }
})
