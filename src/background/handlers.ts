import { createBackup, parseBackup } from '../shared/backup'
import { historyLinker } from '../shared/history'
import type {
  AddStreamerResult,
  AddTeamResult,
  ChannelSuggestion,
  ImportResult,
  MessageRequest,
  MessageResponse,
  MessageType,
  TeamSuggestion
} from '../shared/messages'
import { loadSettings, updateSettings } from '../shared/settings'
import { createStreamer, isValidLogin, isValidTeamName, type Streamer } from '../shared/streamer'
import { applyLiveState, checkAllStreamers } from './checker'
import { isLookalike, lookalikeLogins, rankChannels } from './channel-ranking'
import { HISTORY_LIMIT } from './config'
import {
  clearHistory,
  deleteStreamers,
  getAllStreamers,
  getHistory,
  importHistory,
  patchStreamers,
  putStreamers
} from './database'
import { getAuthState, getToken, login, logout } from './twitch-auth'
import {
  getFollowerTotal,
  getLiveStreams,
  getTeam,
  getUsersByLogin,
  searchChannels,
  type TwitchUser
} from './twitch-api'

type Handlers = { [K in MessageType]: (payload: MessageRequest<K>) => Promise<MessageResponse<K>> }

const MAX_QUERY_LENGTH = 50
const SUGGESTION_LIMIT = 5

async function withBaselineLiveState(token: string, streamers: Streamer[]): Promise<Streamer[]> {
  const live = await getLiveStreams(
    token,
    streamers.map((streamer) => streamer.login)
  )
  const now = Date.now()
  for (const streamer of streamers) applyLiveState(streamer, live.get(streamer.login), now)
  return streamers
}

async function addStreamer(loginInput: string): Promise<AddStreamerResult> {
  const loginName = loginInput.trim().toLowerCase()
  if (!isValidLogin(loginName)) return { status: 'notFound' }
  const existing = await getAllStreamers()
  if (existing.some((streamer) => streamer.login === loginName)) return { status: 'duplicate' }

  const token = await getToken()
  if (!token) return { status: 'disconnected' }
  const [user] = await getUsersByLogin(token, [loginName])
  if (!user) return { status: 'notFound' }

  const [streamer] = await withBaselineLiveState(token, [
    createStreamer({
      login: user.login,
      displayName: user.displayName,
      twitchId: user.id,
      avatarUrl: user.avatarUrl
    })
  ])
  if (!streamer) return { status: 'notFound' }
  await putStreamers([streamer])
  void checkAllStreamers()
  return { status: 'added', streamer }
}

async function addTeam(nameInput: string): Promise<AddTeamResult> {
  const name = nameInput.trim().toLowerCase()
  if (!isValidTeamName(name)) return { status: 'notFound' }
  const token = await getToken()
  if (!token) return { status: 'disconnected' }
  const team = await getTeam(token, name)
  if (!team) return { status: 'notFound' }
  if (team.members.length === 0) return { status: 'empty' }

  const existing = new Map((await getAllStreamers()).map((streamer) => [streamer.login, streamer]))
  const teamFields = { team: team.name, teamDisplayName: team.displayName, teamLogoUrl: team.logoUrl }
  const created: Streamer[] = []
  const patches = new Map<string, Partial<Streamer>>()

  for (const member of team.members) {
    const current = existing.get(member.login)
    if (current) {
      patches.set(current.id, teamFields)
      continue
    }
    created.push({
      ...createStreamer({
        login: member.login,
        displayName: member.displayName,
        twitchId: member.id,
        avatarUrl: null
      }),
      ...teamFields
    })
  }

  await patchStreamers(patches)
  await putStreamers(await withBaselineLiveState(token, created))
  void checkAllStreamers()
  return { status: 'added', displayName: team.displayName, added: created.length }
}

async function followerTotals(token: string, users: TwitchUser[]): Promise<Map<string, number>> {
  const totals = await Promise.all(
    users.map(async (user): Promise<[string, number] | null> => {
      const total = await getFollowerTotal(token, user.id).catch(() => null)
      return total === null ? null : [user.login, total]
    })
  )
  return new Map(totals.filter((entry) => entry !== null))
}

async function suggestChannels(queryInput: string): Promise<ChannelSuggestion[]> {
  const query = queryInput.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH)
  if (query.length < 2) return []
  const token = await getToken()
  if (!token) return []
  const [found, lookalikes] = await Promise.all([
    searchChannels(token, query),
    getUsersByLogin(token, lookalikeLogins(query))
  ])
  const known = new Set(found.map((channel) => channel.login))
  const missing = lookalikes.filter((user) => !known.has(user.login))
  const [live, followers] = await Promise.all([
    missing.length > 0
      ? getLiveStreams(
          token,
          missing.map((user) => user.login)
        )
      : new Map<string, unknown>(),
    followerTotals(
      token,
      lookalikes.filter((user) => isLookalike(user.login, query))
    )
  ])
  const extra = missing.map((user) => ({
    login: user.login,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isLive: live.has(user.login)
  }))
  return rankChannels([...found, ...extra], query, SUGGESTION_LIMIT, followers)
}

async function findTeam(nameInput: string): Promise<TeamSuggestion | null> {
  const name = nameInput.trim().toLowerCase()
  if (!isValidTeamName(name)) return null
  const token = await getToken()
  if (!token) return null
  const team = await getTeam(token, name)
  if (!team) return null
  return {
    name: team.name,
    displayName: team.displayName,
    logoUrl: team.logoUrl,
    memberCount: team.members.length
  }
}

async function deleteTeam(team: string): Promise<null> {
  const streamers = await getAllStreamers()
  await deleteStreamers(streamers.filter((streamer) => streamer.team === team).map((streamer) => streamer.id))
  return null
}

async function importBackup(raw: unknown): Promise<ImportResult> {
  const backup = parseBackup(raw)
  if (!backup) throw new Error('invalidBackup')

  const known = new Set((await getAllStreamers()).map((streamer) => streamer.login))
  const fresh = backup.streamers.filter((streamer) => !known.has(streamer.login))
  await putStreamers(fresh.map((streamer) => ({ ...streamer, id: crypto.randomUUID() })))
  await updateSettings(backup.settings)
  const historyAdded = await importHistory(backup.history.map(historyLinker(backup.streamers)))
  void checkAllStreamers()
  return { streamersAdded: fresh.length, historyAdded }
}

export const handlers: Handlers = {
  getStreamers: () => getAllStreamers(),
  refresh: async () => {
    await checkAllStreamers()
    return getAllStreamers()
  },
  addStreamer: ({ login: loginName }) => addStreamer(loginName),
  addTeam: ({ name }) => addTeam(name),
  deleteStreamer: async ({ id }) => {
    await deleteStreamers([id])
    return null
  },
  deleteTeam: ({ team }) => deleteTeam(team),
  setPause: async ({ ids, snoozedUntil, muted }) => {
    await patchStreamers(new Map(ids.map((id): [string, Partial<Streamer>] => [id, { snoozedUntil, muted }])))
    return null
  },
  searchChannels: ({ query }) => suggestChannels(query),
  findTeam: ({ name }) => findTeam(name),
  getHistory: ({ limit }) => getHistory(Math.min(Math.max(limit, 1), HISTORY_LIMIT)),
  clearHistory: async () => {
    await clearHistory()
    return null
  },
  getAuthState: () => getAuthState(),
  login: async () => {
    const profile = await login()
    void checkAllStreamers()
    return profile
  },
  logout: async () => {
    await logout()
    return null
  },
  exportBackup: async () =>
    createBackup(await getAllStreamers(), await loadSettings(), await getHistory(HISTORY_LIMIT)),
  importBackup: ({ backup }) => importBackup(backup)
}
