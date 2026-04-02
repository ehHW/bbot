import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AppSettings {
    systemTitle: string
    menuHoverExpandDelayMs: number
    themeMode: 'light' | 'dark'
}

const defaultSettings: AppSettings = {
    systemTitle: 'Bbot 管理后台',
    menuHoverExpandDelayMs: 300,
    themeMode: 'light',
}

export const useSettingsStore = defineStore(
    'settings',
    () => {
        const settings = ref<AppSettings>({ ...defaultSettings })

        const save = (next: Partial<AppSettings>) => {
            settings.value = {
                ...settings.value,
                ...next,
                menuHoverExpandDelayMs: normalizeDelay(next.menuHoverExpandDelayMs ?? settings.value.menuHoverExpandDelayMs),
                themeMode: normalizeThemeMode(next.themeMode ?? settings.value.themeMode),
            }
        }

        const reset = () => {
            settings.value = { ...defaultSettings }
        }

        const systemTitle = computed(() => settings.value.systemTitle)
        const menuHoverExpandDelayMs = computed(() => settings.value.menuHoverExpandDelayMs)
        const themeMode = computed(() => settings.value.themeMode)

        return {
            settings,
            systemTitle,
            menuHoverExpandDelayMs,
            themeMode,
            save,
            reset,
        }
    },
    {
        persist: true,
    },
)

function normalizeDelay(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return defaultSettings.menuHoverExpandDelayMs
    }
    return Math.min(2000, Math.max(100, Math.round(value)))
}

function normalizeThemeMode(value: AppSettings['themeMode'] | undefined): AppSettings['themeMode'] {
    return value === 'dark' ? 'dark' : 'light'
}
