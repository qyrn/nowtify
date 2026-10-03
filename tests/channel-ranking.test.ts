import { describe, expect, it } from 'vitest'
import { rankChannels } from '../src/background/channel-ranking'
import type { ChannelSuggestion } from '../src/shared/messages'

function channel(login: string, isLive = false): ChannelSuggestion {
  return { login, displayName: login, avatarUrl: null, isLive }
}

describe('rankChannels', () => {
  it('keeps Kamet0 first when Twitch ranks him first for "kameto"', () => {
    const fromTwitch = [
      channel('kamet0', true),
      channel('kameto'),
      channel('kametori_'),
      channel('kametobot_')
    ]
    expect(rankChannels(fromTwitch, 'kameto', 5).map((item) => item.login)).toEqual([
      'kamet0',
      'kameto',
      'kametori_',
      'kametobot_'
    ])
  })

  it('treats digits that look like letters as those letters', () => {
    const fromTwitch = [channel('kametori_'), channel('kamet0')]
    expect(rankChannels(fromTwitch, 'kameto', 5)[0]?.login).toBe('kamet0')
  })

  it('keeps the channels Twitch matched on something else, after the name matches', () => {
    const fromTwitch = [channel('lck'), channel('kameto')]
    expect(rankChannels(fromTwitch, 'kameto', 5).map((item) => item.login)).toEqual(['kameto', 'lck'])
  })

  it('stops at the limit', () => {
    const fromTwitch = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((login) => channel(login))
    expect(rankChannels(fromTwitch, 'a', 5)).toHaveLength(5)
  })
})
