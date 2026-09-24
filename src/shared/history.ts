import { isRecord, readNumber, readString } from './guards'

export interface HistoryEntry {
  streamerId: string
  displayName: string
  title: string | null
  game: string | null
  viewerCount: number | null
  timestamp: number
  startedAt: number | null
  endedAt: number | null
}

export interface HistoryStats {
  total: number
  thisWeek: number
  topStreamer: { name: string; count: number } | null
  topGame: { name: string; count: number } | null
}

const WEEK = 7 * 24 * 60 * 60 * 1000

export function normalizeHistoryEntry(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw)) return null
  const streamerId = readString(raw, 'streamerId')
  const displayName = readString(raw, 'displayName') ?? readString(raw, 'name')
  const timestamp = readNumber(raw, 'timestamp')
  if (!streamerId || !displayName || timestamp === null) return null

  return {
    streamerId,
    displayName,
    title: readString(raw, 'title'),
    game: readString(raw, 'game'),
    viewerCount: readNumber(raw, 'viewerCount'),
    timestamp,
    startedAt: readNumber(raw, 'startedAt'),
    endedAt: readNumber(raw, 'endedAt')
  }
}

export function streamDuration(entry: HistoryEntry): number | null {
  if (entry.startedAt === null || entry.endedAt === null) return null
  const duration = entry.endedAt - entry.startedAt
  return duration > 0 ? duration : null
}

function mostFrequent(values: string[]): { name: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: { name: string; count: number } | null = null
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count }
  }
  return best
}

export function computeStats(history: HistoryEntry[], now = Date.now()): HistoryStats {
  return {
    total: history.length,
    thisWeek: history.filter((entry) => now - entry.timestamp < WEEK).length,
    topStreamer: mostFrequent(history.map((entry) => entry.displayName)),
    topGame: mostFrequent(history.flatMap((entry) => (entry.game ? [entry.game] : [])))
  }
}
