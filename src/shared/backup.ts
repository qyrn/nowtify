import { isRecord, readRecords } from './guards'
import { normalizeHistoryEntry, type HistoryEntry } from './history'
import { normalizeSettings, type Settings } from './settings'
import { normalizeStreamer, type Streamer } from './streamer'

export interface Backup {
  app: 'nowtify'
  version: 2
  exportedAt: string
  streamers: Streamer[]
  settings: Settings
  history: HistoryEntry[]
}

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
const MAX_STREAMERS = 2000
const MAX_HISTORY = 5000

export function createBackup(streamers: Streamer[], settings: Settings, history: HistoryEntry[]): Backup {
  return { app: 'nowtify', version: 2, exportedAt: new Date().toISOString(), streamers, settings, history }
}

export function parseBackup(raw: unknown): Backup | null {
  if (!isRecord(raw)) return null
  const content = raw.app === 'nowtify' ? raw : raw.data
  if (!isRecord(content)) return null

  const streamers = readRecords(content, 'streamers')
    .slice(0, MAX_STREAMERS)
    .map(normalizeStreamer)
    .filter((streamer) => streamer !== null)
  const history = readRecords(content, 'history')
    .slice(0, MAX_HISTORY)
    .map(normalizeHistoryEntry)
    .filter((entry) => entry !== null)

  if (streamers.length === 0 && history.length === 0) return null

  return createBackup(streamers, normalizeSettings(content.settings), history)
}
