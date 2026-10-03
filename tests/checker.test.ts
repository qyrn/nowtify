import { describe, expect, it } from 'vitest'
import { applyLiveState, shouldNotify } from '../src/background/checker'
import { NOTIFICATION_COOLDOWN } from '../src/background/config'
import type { TwitchStream } from '../src/background/twitch-api'
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
    expect(target).toMatchObject({ isLive: false, viewerCount: null, thumbnailUrl: null, lastLiveAt: NOW })
  })
})
