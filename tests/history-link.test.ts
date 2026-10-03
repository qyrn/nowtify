import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { getHistory } from '../src/background/database'
import { historyLinker, type HistoryEntry } from '../src/shared/history'
import { channelKey } from '../src/shared/streamer'

function entry(streamerId: string, timestamp: number): HistoryEntry {
  return {
    streamerId,
    displayName: 'Kameto',
    title: null,
    game: null,
    viewerCount: null,
    timestamp,
    startedAt: timestamp,
    endedAt: null
  }
}

function seedVersionTwoDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NowtifyDB', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('streamers', { keyPath: 'id' }).put({
        id: 'uuid-1',
        login: 'kamet0',
        twitchId: '42'
      })
      const history = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true })
      history.createIndex('timestamp', 'timestamp')
      history.createIndex('streamerId', 'streamerId')
      history.add(entry('uuid-1', 10))
      history.add(entry('removed-streamer', 5))
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('seed failed'))
    }
  })
}

describe('channelKey', () => {
  it('prefers the Twitch id and falls back to the login', () => {
    expect(channelKey({ twitchId: '42', login: 'kamet0' })).toBe('42')
    expect(channelKey({ twitchId: null, login: 'kamet0' })).toBe('kamet0')
  })
})

describe('historyLinker', () => {
  it('rewrites entries of known streamers to their channel and keeps the others', () => {
    const link = historyLinker([{ id: 'uuid-1', twitchId: '42', login: 'kamet0' }])
    expect(link(entry('uuid-1', 1)).streamerId).toBe('42')
    expect(link(entry('unknown', 1)).streamerId).toBe('unknown')
  })
})

describe('database upgrade', () => {
  it('links the existing history to Twitch channels', async () => {
    await seedVersionTwoDatabase()
    const history = await getHistory(10)
    expect(history.map((item) => item.streamerId)).toEqual(['42', 'removed-streamer'])
  })
})
