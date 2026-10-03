import { browser } from 'wxt/browser'
import { isRecord, readNumber } from '../shared/guards'
import { getFollowedChannels, type FollowedChannel } from './twitch-api'
import { connectedUserId, hasFollowsAccess } from './twitch-auth'

const CACHE_KEY = 'twitchFollows'
const MAX_FOLLOWS = 2000
const REFRESH_INTERVAL = 24 * 60 * 60 * 1000

let refreshing: Promise<FollowedChannel[] | null> | null = null

async function readCache(): Promise<{ logins: string[]; fetchedAt: number } | null> {
  const stored = await browser.storage.local.get(CACHE_KEY)
  const cache = stored[CACHE_KEY]
  if (!isRecord(cache) || !Array.isArray(cache.logins)) return null
  return {
    logins: cache.logins.filter((login) => typeof login === 'string'),
    fetchedAt: readNumber(cache, 'fetchedAt') ?? 0
  }
}

export async function fetchFollows(token: string): Promise<FollowedChannel[] | null> {
  if (!(await hasFollowsAccess())) return null
  const userId = await connectedUserId(token)
  if (!userId) return null
  const channels = await getFollowedChannels(token, userId, MAX_FOLLOWS)
  await browser.storage.local.set({
    [CACHE_KEY]: { logins: channels.map((channel) => channel.login), fetchedAt: Date.now() }
  })
  return channels
}

export async function followedLogins(token: string): Promise<Set<string>> {
  const cache = await readCache()
  if (Date.now() - (cache?.fetchedAt ?? 0) > REFRESH_INTERVAL && (await hasFollowsAccess())) {
    refreshing ??= fetchFollows(token)
      .catch(() => null)
      .finally(() => {
        refreshing = null
      })
  }
  return new Set(cache?.logins ?? [])
}
