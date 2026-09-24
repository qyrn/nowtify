import { describe, expect, it } from 'vitest'
import { parseBackup } from '../src/shared/backup'
import { computeStats, streamDuration, type HistoryEntry } from '../src/shared/history'

function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    streamerId: 'a',
    displayName: 'A',
    title: null,
    game: null,
    viewerCount: null,
    timestamp: 0,
    startedAt: null,
    endedAt: null,
    ...overrides
  }
}

describe('parseBackup', () => {
  it('reads the v3.3 export format', () => {
    const backup = parseBackup({
      version: '1.0',
      exportDate: '2026-08-24T10:00:00.000Z',
      data: {
        streamers: [{ id: 'a', username: 'kameto', name: 'Kameto', platform: 'twitch' }, { username: '!!' }],
        settings: { notifications: false, theme: 'dark' },
        history: [{ streamerId: 'a', name: 'Kameto', platform: 'twitch', timestamp: 10, duration: 5 }]
      }
    })
    expect(backup?.streamers.map((streamer) => streamer.login)).toEqual(['kameto'])
    expect(backup?.settings.notifications).toBe(false)
    expect(backup?.history[0]).toMatchObject({ displayName: 'Kameto', timestamp: 10, endedAt: null })
  })

  it('refuses files that are not backups', () => {
    expect(parseBackup({ hello: 'world' })).toBeNull()
    expect(parseBackup([])).toBeNull()
    expect(parseBackup({ app: 'nowtify', streamers: [] })).toBeNull()
  })
})

describe('history helpers', () => {
  it('computes the duration only for finished streams', () => {
    expect(streamDuration(entry({ startedAt: 100, endedAt: 400 }))).toBe(300)
    expect(streamDuration(entry({ startedAt: 100 }))).toBeNull()
  })

  it('finds the most frequent streamer and game', () => {
    const now = 30 * 24 * 60 * 60 * 1000
    const stats = computeStats(
      [
        entry({ displayName: 'A', game: 'Chess', timestamp: now - 1000 }),
        entry({ displayName: 'B', game: 'Chess', timestamp: now - 1000 }),
        entry({ displayName: 'A' })
      ],
      now
    )
    expect(stats).toEqual({
      total: 3,
      thisWeek: 2,
      topStreamer: { name: 'A', count: 2 },
      topGame: { name: 'Chess', count: 2 }
    })
  })
})
