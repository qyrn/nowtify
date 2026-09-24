import { browser } from 'wxt/browser'
import { isRecord, readBoolean } from './guards'

export interface Settings {
  notifications: boolean
  persistentNotifications: boolean
  confirmDelete: boolean
  compactMode: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  notifications: true,
  persistentNotifications: false,
  confirmDelete: true,
  compactMode: false
}

export function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS }
  return {
    notifications: readBoolean(raw, 'notifications') ?? DEFAULT_SETTINGS.notifications,
    persistentNotifications:
      readBoolean(raw, 'persistentNotifications') ?? DEFAULT_SETTINGS.persistentNotifications,
    confirmDelete: readBoolean(raw, 'confirmDelete') ?? DEFAULT_SETTINGS.confirmDelete,
    compactMode: readBoolean(raw, 'compactMode') ?? DEFAULT_SETTINGS.compactMode
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
