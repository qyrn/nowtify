import { describe, expect, it } from 'vitest'
import { lookalikeLogins, rankChannels } from '../src/background/channel-ranking'
import type { TwitchChannel } from '../src/background/twitch-api'

function channel(login: string, isLive = false): TwitchChannel {
  return { login, displayName: login, avatarUrl: null, isLive }
}

const TWITCH_SEARCH_FOR_KAMETO = [
  'kametori_',
  'kametoreact',
  'kameto',
  'kabetotv',
  'kametosha',
  'kameton45g',
  'kametobot_'
].map((login) => channel(login))

describe('lookalikeLogins', () => {
  it('includes the zero version of an o', () => {
    expect(lookalikeLogins('kameto')).toContain('kamet0')
  })

  it('includes the letter version of a digit', () => {
    expect(lookalikeLogins('kamet0')).toContain('kameto')
  })

  it('returns nothing for text that cannot be a login', () => {
    expect(lookalikeLogins('team/solary')).toEqual([])
  })
})

describe('rankChannels', () => {
  it('puts the big look-alike account first, then the exact one', () => {
    const channels = [...TWITCH_SEARCH_FOR_KAMETO, channel('kamet0', true)]
    const followers = new Map([
      ['kameto', 910],
      ['kamet0', 2_129_717]
    ])
    expect(rankChannels(channels, 'kameto', 5, followers).map((item) => item.login)).toEqual([
      'kamet0',
      'kameto',
      'kametori_',
      'kametoreact',
      'kametosha'
    ])
  })

  it('sorts names that match equally by followers', () => {
    const channels = [channel('kametoreact'), channel('kametori_'), channel('kametosha')]
    const followers = new Map([
      ['kametoreact', 120],
      ['kametori_', 5400],
      ['kametosha', 30]
    ])
    expect(rankChannels(channels, 'kameto', 5, followers).map((item) => item.login)).toEqual([
      'kametori_',
      'kametoreact',
      'kametosha'
    ])
  })

  it('keeps the Twitch order without follower data', () => {
    expect(rankChannels(TWITCH_SEARCH_FOR_KAMETO, 'kameto', 3, new Map()).map((item) => item.login)).toEqual([
      'kameto',
      'kametori_',
      'kametoreact'
    ])
  })

  it('keeps channels Twitch matched on something else, after the name matches', () => {
    const channels = [channel('lck'), channel('kameto')]
    expect(rankChannels(channels, 'kameto', 5, new Map()).map((item) => item.login)).toEqual([
      'kameto',
      'lck'
    ])
  })
})
