import type { ChannelSuggestion } from '../shared/messages'
import { lookalikeLogins, rankChannels } from './channel-ranking'
import { followedLogins } from './follows'
import {
  getFollowerTotal,
  getLiveStreams,
  getUsersByLogin,
  searchChannels,
  type TwitchChannel,
  type TwitchUser
} from './twitch-api'

const SHORTLIST_SIZE = 10
const FOLLOWERS_CACHE_TTL = 60 * 60 * 1000

const followersCache = new Map<string, { total: number; fetchedAt: number }>()

async function followerTotal(token: string, user: TwitchUser, now: number): Promise<number | null> {
  const cached = followersCache.get(user.login)
  if (cached && now - cached.fetchedAt < FOLLOWERS_CACHE_TTL) return cached.total
  const total = await getFollowerTotal(token, user.id).catch(() => null)
  if (total !== null) followersCache.set(user.login, { total, fetchedAt: now })
  return total
}

async function followerTotals(token: string, users: TwitchUser[]): Promise<Map<string, number>> {
  const now = Date.now()
  const totals = await Promise.all(
    users.map(async (user): Promise<[string, number] | null> => {
      const total = await followerTotal(token, user, now)
      return total === null ? null : [user.login, total]
    })
  )
  return new Map(totals.filter((entry) => entry !== null))
}

async function withLookalikes(token: string, query: string): Promise<TwitchChannel[]> {
  const [found, lookalikes] = await Promise.all([
    searchChannels(token, query),
    getUsersByLogin(token, lookalikeLogins(query))
  ])
  const known = new Set(found.map((channel) => channel.login))
  const missing = lookalikes.filter((user) => !known.has(user.login))
  if (missing.length === 0) return found
  const live = await getLiveStreams(
    token,
    missing.map((user) => user.login)
  )
  return [
    ...found,
    ...missing.map((user) => ({
      login: user.login,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isLive: live.has(user.login)
    }))
  ]
}

export async function suggestChannels(
  token: string,
  query: string,
  limit: number
): Promise<ChannelSuggestion[]> {
  const [channels, followed] = await Promise.all([withLookalikes(token, query), followedLogins(token)])
  const shortlist = rankChannels(channels, query, SHORTLIST_SIZE, new Map(), followed)
  const users = await getUsersByLogin(
    token,
    shortlist.map((channel) => channel.login)
  )
  const followers = await followerTotals(token, users)
  const partners = new Set(users.filter((user) => user.partner).map((user) => user.login))
  const suggestions = shortlist.map((channel) => ({
    ...channel,
    followers: followers.get(channel.login) ?? null,
    partner: partners.has(channel.login)
  }))
  return rankChannels(suggestions, query, limit, followers, followed)
}
