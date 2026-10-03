import { browser } from 'wxt/browser'
import { isRecord, readBoolean, readString } from './guards'

export const THEMES = ['auto', 'dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export interface Settings {
  notifications: boolean
  persistentNotifications: boolean
  confirmDelete: boolean
  theme: Theme
}

export const DEFAULT_SETTINGS: Settings = {
  notifications: true,
  persistentNotifications: false,
  confirmDelete: true,
  theme: 'auto'
}

export function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value)
}

export function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS }
  const theme = readString(raw, 'theme')
  return {
    notifications: readBoolean(raw, 'notifications') ?? DEFAULT_SETTINGS.notifications,
    persistentNotifications:
      readBoolean(raw, 'persistentNotifications') ?? DEFAULT_SETTINGS.persistentNotifications,
    confirmDelete: readBoolean(raw, 'confirmDelete') ?? DEFAULT_SETTINGS.confirmDelete,
    theme: isTheme(theme) ? theme : DEFAULT_SETTINGS.theme
  }
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get('settings')
  return normalizeSettings(stored.settings)
}

export async function updateSettings(changes: Partial<Settings>): Promise<Settings> {
  const settings = { ...(await loadSettings()), ...changes }
  await browser.storage.sync.set({ settings })
  return settings
}
