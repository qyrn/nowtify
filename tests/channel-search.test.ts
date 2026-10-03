import { afterEach, describe, expect, it, vi } from 'vitest'
import { suggestChannels } from '../src/background/channel-search'

const USERS: Record<string, { id: string; broadcaster_type: string; followers: number }> = {
  kamet0: { id: '1', broadcaster_type: 'partner', followers: 2_129_717 },
  kameto: { id: '2', broadcaster_type: '', followers: 910 },
  kametori_: { id: '3', broadcaster_type: 'affiliate', followers: 5400 }
}

function respond(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function fakeTwitch(url: string): Response {
  const { pathname, searchParams } = new URL(url)
  if (pathname.endsWith('/search/channels')) {
    return respond({
      data: ['kametori_', 'kameto'].map((login) => ({
        broadcaster_login: login,
        display_name: login,
        thumbnail_url: null,
        is_live: false
      }))
    })
  }
  if (pathname.endsWith('/users')) {
    const logins = searchParams.getAll('login').filter((login) => login in USERS)
    return respond({
      data: logins.map((login) => ({
        id: USERS[login]?.id,
        login,
        display_name: login,
        broadcaster_type: USERS[login]?.broadcaster_type
      }))
    })
  }
  if (pathname.endsWith('/streams')) return respond({ data: [{ user_login: 'kamet0', viewer_count: 18100 }] })
  if (pathname.endsWith('/channels/followers')) {
    const user = Object.values(USERS).find((candidate) => candidate.id === searchParams.get('broadcaster_id'))
    return respond({ total: user?.followers ?? 0, data: [] })
  }
  return new Response(null, { status: 404 })
}

describe('suggestChannels', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('puts Kamet0 first with his followers and partner badge', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(fakeTwitch(urlOf(input))))
    const suggestions = await suggestChannels('token', 'kameto', 5)
    expect(
      suggestions.map(({ login, followers, partner, isLive }) => ({ login, followers, partner, isLive }))
    ).toEqual([
      { login: 'kamet0', followers: 2_129_717, partner: true, isLive: true },
      { login: 'kameto', followers: 910, partner: false, isLive: false },
      { login: 'kametori_', followers: 5400, partner: false, isLive: false }
    ])
  })

  it('reuses follower counts instead of asking Twitch again', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => Promise.resolve(fakeTwitch(urlOf(input))))
    await suggestChannels('token', 'kameto', 5)
    const followerCalls = fetch.mock.calls.filter(([input]) => urlOf(input).includes('/channels/followers'))
    expect(followerCalls).toHaveLength(0)
  })
})
