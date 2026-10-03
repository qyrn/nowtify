import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { fetchFollows, followedLogins } from '../src/background/follows'
import { FOLLOWS_SCOPE, hasFollowsAccess, requestFollowsAccess } from '../src/background/twitch-auth'

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function respond(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function followedPage(url: string): Response {
  const after = new URL(url).searchParams.get('after')
  if (!after) {
    return respond({
      data: [{ broadcaster_login: 'kamet0', broadcaster_name: 'Kamet0' }],
      pagination: { cursor: 'page-2' }
    })
  }
  return respond({ data: [{ broadcaster_login: 'zerator', broadcaster_name: 'ZeratoR' }], pagination: {} })
}

describe('follows access', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.spyOn(fakeBrowser.identity, 'getRedirectURL').mockReturnValue('https://extension.chromiumapp.org/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function answerAuth(scope: string | null) {
    const state = '00000000-0000-4000-8000-000000000000'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(state)
    const hash = new URLSearchParams({ access_token: 'token', state })
    if (scope !== null) hash.set('scope', scope)
    const redirect = `https://extension.chromiumapp.org/#${hash.toString()}`
    vi.spyOn(fakeBrowser.identity, 'launchWebAuthFlow').mockResolvedValue(redirect as never)
  }

  it('remembers the follows permission once Twitch grants it', async () => {
    answerAuth(FOLLOWS_SCOPE)
    expect(await requestFollowsAccess()).toBe(true)
    expect(await hasFollowsAccess()).toBe(true)
  })

  it('reports a refusal without storing anything', async () => {
    answerAuth('')
    expect(await requestFollowsAccess()).toBe(false)
    expect(await hasFollowsAccess()).toBe(false)
  })
})

describe('fetchFollows', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    await fakeBrowser.storage.local.set({
      twitchScopes: [FOLLOWS_SCOPE],
      twitchUser: { id: '99', login: 'qyrn', displayName: 'qyrn' }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads every page and keeps the list for the search', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => Promise.resolve(followedPage(urlOf(input))))
    const channels = await fetchFollows('token')
    expect(channels?.map((channel) => channel.login)).toEqual(['kamet0', 'zerator'])
    expect([...(await followedLogins('token'))]).toEqual(['kamet0', 'zerator'])
  })

  it('returns nothing without the permission', async () => {
    await fakeBrowser.storage.local.remove('twitchScopes')
    expect(await fetchFollows('token')).toBeNull()
  })
})
