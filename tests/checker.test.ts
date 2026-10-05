import { describe, expect, it } from 'vitest'
import { applyArchive, applyLiveState, shouldNotify } from '../src/background/checker'
import { NOTIFICATION_COOLDOWN } from '../src/background/config'
import { parseVideoDuration, type TwitchArchive, type TwitchStream } from '../src/background/twitch-api'
import { createStreamer, type Streamer } from '../src/shared/streamer'

const NOW = 1_000_000_000

function streamer(fields: Partial<Streamer> = {}): Streamer {
  return {
    ...createStreamer({ login: 'kamet0', displayName: 'Kamet0', twitchId: '42', avatarUrl: null }),
    ...fields
  }
}

const stream: TwitchStream = {
  login: 'kamet0',
  title: 'Watchparty',
  game: 'League of Legends',
  viewerCount: 18100,
  thumbnailUrl: null,
  startedAt: NOW - 60_000
}

describe('shouldNotify', () => {
  it('notifies when a streamer goes live', () => {
    expect(shouldNotify(streamer(), streamer({ isLive: true }), NOW)).toBe(true)
  })

  it('stays quiet while the stream keeps going', () => {
    expect(shouldNotify(streamer({ isLive: true }), streamer({ isLive: true }), NOW)).toBe(false)
  })

  it('stays quiet for a paused streamer', () => {
    expect(shouldNotify(streamer(), streamer({ isLive: true, snoozedUntil: NOW + 1 }), NOW)).toBe(false)
  })

  it('notifies again once the pause is over', () => {
    expect(shouldNotify(streamer(), streamer({ isLive: true, snoozedUntil: NOW - 1 }), NOW)).toBe(true)
  })

  it('never notifies for a muted streamer', () => {
    expect(shouldNotify(streamer(), streamer({ isLive: true, muted: true }), NOW)).toBe(false)
  })

  it('ignores a stream that restarts right after a crash', () => {
    const next = streamer({ isLive: true, notifiedAt: NOW - NOTIFICATION_COOLDOWN + 1 })
    expect(shouldNotify(streamer(), next, NOW)).toBe(false)
  })

  it('notifies again after the cooldown', () => {
    const next = streamer({ isLive: true, notifiedAt: NOW - NOTIFICATION_COOLDOWN })
    expect(shouldNotify(streamer(), next, NOW)).toBe(true)
  })
})

describe('applyLiveState', () => {
  it('copies the stream details when the streamer is live', () => {
    const target = streamer()
    applyLiveState(target, stream, NOW)
    expect(target).toMatchObject({
      isLive: true,
      title: 'Watchparty',
      viewerCount: 18100,
      startedAt: NOW - 60_000,
      lastLiveAt: NOW,
      nextStreamAt: null
    })
  })

  it('records when the stream ended and clears the live details', () => {
    const target = streamer({ isLive: true, viewerCount: 18100, lastLiveAt: NOW - 60_000 })
    applyLiveState(target, undefined, NOW)
    expect(target).toMatchObject({
      isLive: false,
      viewerCount: null,
      thumbnailUrl: null,
      lastLiveAt: NOW,
      vodCheckedAt: null
    })
  })
})

const HOUR = 60 * 60_000

function archive(fields: Partial<TwitchArchive> = {}): TwitchArchive {
  return {
    id: '2200',
    title: 'Watchparty',
    startedAt: NOW - 4 * HOUR,
    duration: 3 * HOUR,
    viewCount: 52000,
    thumbnailUrl: 'https://static-cdn.jtvnw.net/cf_vods/thumb-440x248.jpg',
    ...fields
  }
}

describe('applyArchive', () => {
  it('keeps the replay of the stream the extension saw end', () => {
    const target = streamer({ title: 'Watchparty', game: 'Just Chatting', lastLiveAt: NOW - HOUR - 60_000 })
    applyArchive(target, archive())
    expect(target).toMatchObject({
      lastVod: { id: '2200', duration: 3 * HOUR, viewCount: 52000 },
      title: 'Watchparty',
      game: 'Just Chatting',
      lastLiveAt: NOW - HOUR
    })
  })

  it('takes the replay title for a stream the extension missed', () => {
    const target = streamer({ title: 'Old title', game: 'Minecraft', lastLiveAt: NOW - 48 * HOUR })
    applyArchive(target, archive({ title: 'Night stream' }))
    expect(target).toMatchObject({ title: 'Night stream', game: null, lastLiveAt: NOW - HOUR })
  })

  it('drops a replay older than the last stream', () => {
    const target = streamer({
      lastLiveAt: NOW,
      lastVod: { id: '1', duration: HOUR, viewCount: 3, thumbnailUrl: null }
    })
    applyArchive(target, archive())
    expect(target).toMatchObject({ lastVod: null, lastLiveAt: NOW })
  })

  it('clears the replay when the channel has none', () => {
    const target = streamer({ lastVod: { id: '1', duration: HOUR, viewCount: 3, thumbnailUrl: null } })
    applyArchive(target, null)
    expect(target.lastVod).toBeNull()
  })

  it('forgets the replay once the streamer is live again', () => {
    const target = streamer({ lastVod: { id: '1', duration: HOUR, viewCount: 3, thumbnailUrl: null } })
    applyLiveState(target, stream, NOW)
    expect(target.lastVod).toBeNull()
  })
})

describe('parseVideoDuration', () => {
  it('reads the Twitch duration format', () => {
    expect(parseVideoDuration('3h8m33s')).toBe(((3 * 60 + 8) * 60 + 33) * 1000)
    expect(parseVideoDuration('42m')).toBe(42 * 60_000)
    expect(parseVideoDuration('15s')).toBe(15_000)
  })

  it('rejects anything else', () => {
    expect(parseVideoDuration('')).toBeNull()
    expect(parseVideoDuration('3:08:33')).toBeNull()
  })
})
