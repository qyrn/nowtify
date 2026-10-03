import { createBackup, parseBackup } from '../shared/backup'
import { historyLinker } from '../shared/history'
import type {
  AddStreamerResult,
  AddTeamResult,
  ChannelSuggestion,
  FollowsResult,
  ImportResult,
  MessageRequest,
  MessageResponse,
  MessageType,
  TeamSuggestion
} from '../shared/messages'
import { loadSettings, updateSettings } from '../shared/settings'
import { createStreamer, isValidLogin, isValidTeamName, type Streamer } from '../shared/streamer'
import { applyLiveState, checkAllStreamers, refreshIfStale } from './checker'
import { suggestChannels } from './channel-search'
import { HISTORY_LIMIT } from './config'
import { fetchFollows } from './follows'
import {
  clearHistory,
  deleteStreamers,
  getAllStreamers,
  getHistory,
  importHistory,
  patchStreamers,
  putStreamers
} from './database'
import { getAuthState, getToken, login, logout, requestFollowsAccess } from './twitch-auth'
import { getLiveStreams, getTeam, getUsersByLogin } from './twitch-api'

type Handlers = { [K in MessageType]: (payload: MessageRequest<K>) => Promise<MessageResponse<K>> }

const MAX_QUERY_LENGTH = 50
const MAX_IMPORT = 500
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

async function twitchFollows(): Promise<FollowsResult> {
  const token = await getToken()
  if (!token) return { status: 'disconnected' }
  const channels = await fetchFollows(token)
  if (!channels) return { status: 'needsAccess' }
  const known = new Set((await getAllStreamers()).map((streamer) => streamer.login))
  return {
    status: 'ok',
    channels: channels.map((channel) => ({ ...channel, added: known.has(channel.login) }))
  }
}

async function importStreamers(loginsInput: string[]): Promise<number> {
  const known = new Set((await getAllStreamers()).map((streamer) => streamer.login))
  const logins = [...new Set(loginsInput.map((login) => login.trim().toLowerCase()))]
    .filter((login) => isValidLogin(login) && !known.has(login))
    .slice(0, MAX_IMPORT)
  if (logins.length === 0) return 0
  const token = await getToken()
  if (!token) return 0
  const users = await getUsersByLogin(token, logins)
  const created = users.map((user) =>
    createStreamer({
      login: user.login,
      displayName: user.displayName,
      twitchId: user.id,
      avatarUrl: user.avatarUrl
    })
  )
  await putStreamers(await withBaselineLiveState(token, created))
  void checkAllStreamers()
  return created.length
}

async function suggestions(queryInput: string): Promise<ChannelSuggestion[]> {
  const query = queryInput.trim().toLowerCase().slice(0, MAX_QUERY_LENGTH)
  if (query.length < 2) return []
  const token = await getToken()
  if (!token) return []
  return suggestChannels(token, query, SUGGESTION_LIMIT)
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
    await refreshIfStale()
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
  searchChannels: ({ query }) => suggestions(query),
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
  importBackup: ({ backup }) => importBackup(backup),
  getTwitchFollows: () => twitchFollows(),
  requestFollowsAccess: () => requestFollowsAccess(),
  importStreamers: ({ logins }) => importStreamers(logins)
}
