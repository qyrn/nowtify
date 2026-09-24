import { describe, expect, it } from 'vitest'
import {
  isRecentlyLive,
  normalizeStreamer,
  parseAddInput,
  sortStreamers,
  type Streamer
} from '../src/shared/streamer'

function streamer(overrides: Partial<Streamer>): Streamer {
  const base = normalizeStreamer({ id: 'x', login: 'base' })
  if (!base) throw new Error('fixture')
  return { ...base, ...overrides }
}

describe('parseAddInput', () => {
  it('reads a plain login', () => {
    expect(parseAddInput('  Kameto ')).toEqual({ kind: 'streamer', login: 'kameto' })
  })

  it('reads a channel link', () => {
    expect(parseAddInput('https://www.twitch.tv/zerator/videos')).toEqual({
      kind: 'streamer',
      login: 'zerator'
    })
  })

  it('reads a team link and the team shortcut', () => {
    expect(parseAddInput('https://twitch.tv/team/solary')).toEqual({ kind: 'team', name: 'solary' })
    expect(parseAddInput('team/karmine-corp')).toEqual({ kind: 'team', name: 'karmine-corp' })
  })

  it('rejects anything that cannot be a Twitch login', () => {
    expect(parseAddInput('not a login')).toBeNull()
    expect(parseAddInput('<script>')).toBeNull()
    expect(parseAddInput('a'.repeat(26))).toBeNull()
  })
})

describe('normalizeStreamer', () => {
  it('migrates records written by v3.3', () => {
    const legacy = normalizeStreamer({
      id: 'twitch_zerator_1',
      name: 'ZeratoR',
      username: 'ZeratoR',
      platform: 'twitch',
      avatar: 'https://static-cdn.jtvnw.net/a.png',
      team: 'Solary',
      teamLogo: 'https://static-cdn.jtvnw.net/t.png',
      lastLiveDate: 1000,
      addedDate: 500,
      thumbnail: 'https://static-cdn.jtvnw.net/thumb.jpg',
      isLive: true,
      priority: 'high'
    })
    expect(legacy).toMatchObject({
      id: 'twitch_zerator_1',
      login: 'zerator',
      displayName: 'ZeratoR',
      avatarUrl: 'https://static-cdn.jtvnw.net/a.png',
      team: 'solary',
      teamLogoUrl: 'https://static-cdn.jtvnw.net/t.png',
      lastLiveAt: 1000,
      addedAt: 500,
      thumbnailUrl: 'https://static-cdn.jtvnw.net/thumb.jpg',
      isLive: true
    })
    expect(legacy).not.toHaveProperty('priority')
  })

  it('drops image URLs that are not https', () => {
    expect(normalizeStreamer({ login: 'a_b', avatarUrl: 'javascript:alert(1)' })?.avatarUrl).toBeNull()
  })

  it('rejects records without a valid login', () => {
    expect(normalizeStreamer({ login: 'bad login' })).toBeNull()
    expect(normalizeStreamer(null)).toBeNull()
  })
})

describe('sortStreamers', () => {
  it('puts live channels first, then the most recently seen', () => {
    const sorted = sortStreamers([
      streamer({ id: 'old', lastLiveAt: 10 }),
      streamer({ id: 'live', isLive: true, startedAt: 5 }),
      streamer({ id: 'recent', lastLiveAt: 50 })
    ])
    expect(sorted.map((item) => item.id)).toEqual(['live', 'recent', 'old'])
  })
})

describe('isRecentlyLive', () => {
  it('only counts offline channels seen in the last 12 hours', () => {
    const now = 100 * 60 * 60 * 1000
    expect(isRecentlyLive(streamer({ lastLiveAt: now - 60_000 }), now)).toBe(true)
    expect(isRecentlyLive(streamer({ lastLiveAt: now - 13 * 60 * 60 * 1000 }), now)).toBe(false)
    expect(isRecentlyLive(streamer({ isLive: true, lastLiveAt: now }), now)).toBe(false)
  })
})
