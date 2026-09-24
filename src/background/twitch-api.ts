import {
  isRecord,
  readBoolean,
  readHttpsUrl,
  readNumber,
  readRecords,
  readString,
  readTimestamp
} from '../shared/guards'
import type { UnknownRecord } from '../shared/guards'
import { TWITCH_CLIENT_ID } from './config'

const HELIX = 'https://api.twitch.tv/helix'
const REQUEST_TIMEOUT = 10_000
const MAX_RETRIES = 2
const BATCH_SIZE = 100

export class TwitchAuthError extends Error {
  constructor() {
    super('Twitch rejected the access token')
  }
}

export interface TwitchUser {
  id: string
  login: string
  displayName: string
  avatarUrl: string | null
}

export interface TwitchStream {
  login: string
  title: string | null
  game: string | null
  viewerCount: number
  thumbnailUrl: string | null
  startedAt: number | null
}

export interface TwitchChannel {
  login: string
  displayName: string
  avatarUrl: string | null
  isLive: boolean
}

export interface TwitchTeamInfo {
  name: string
  displayName: string
  logoUrl: string | null
}

export interface TwitchTeam extends TwitchTeamInfo {
  members: { id: string; login: string; displayName: string }[]
}

type Query = [string, string][]

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function helix(
  token: string,
  path: string,
  query: Query,
  missingStatuses: number[] = [404]
): Promise<UnknownRecord | null> {
  const url = `${HELIX}/${path}?${new URLSearchParams(query).toString()}`
  const init = { headers: { 'Client-ID': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` } }

  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetchWithTimeout(url, init)
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error
      await wait(500 * (attempt + 1))
      continue
    }

    if (response.status === 401) throw new TwitchAuthError()
    if (missingStatuses.includes(response.status)) return null

    const retryable = response.status === 429 || response.status >= 500
    if (retryable && attempt < MAX_RETRIES) {
      const resetHeader = Number(response.headers.get('Ratelimit-Reset'))
      const delay = resetHeader > 0 ? resetHeader * 1000 - Date.now() : 500 * (attempt + 1)
      await wait(Math.min(Math.max(delay, 500), 15_000))
      continue
    }

    if (!response.ok) throw new Error(`Twitch ${path} failed with status ${response.status}`)
    const body: unknown = await response.json()
    return isRecord(body) ? body : null
  }
}

async function helixList(
  token: string,
  path: string,
  query: Query,
  missingStatuses?: number[]
): Promise<UnknownRecord[]> {
  const body = await helix(token, path, query, missingStatuses)
  return body ? readRecords(body, 'data') : []
}

function chunk<T>(items: T[]): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    chunks.push(items.slice(index, index + BATCH_SIZE))
  }
  return chunks
}

function toUser(record: UnknownRecord): TwitchUser | null {
  const id = readString(record, 'id')
  const login = readString(record, 'login')
  if (!id || !login) return null
  return {
    id,
    login,
    displayName: readString(record, 'display_name') ?? login,
    avatarUrl: readHttpsUrl(record, 'profile_image_url')
  }
}

function toStream(record: UnknownRecord): TwitchStream | null {
  const login = readString(record, 'user_login')?.toLowerCase()
  if (!login) return null
  const thumbnail = readString(record, 'thumbnail_url')
  return {
    login,
    title: readString(record, 'title'),
    game: readString(record, 'game_name'),
    viewerCount: readNumber(record, 'viewer_count') ?? 0,
    thumbnailUrl: thumbnail ? thumbnail.replace('{width}', '440').replace('{height}', '248') : null,
    startedAt: readTimestamp(record, 'started_at')
  }
}

export async function getUsersByLogin(token: string, logins: string[]): Promise<TwitchUser[]> {
  const users: TwitchUser[] = []
  for (const group of chunk(logins)) {
    const records = await helixList(
      token,
      'users',
      group.map((login) => ['login', login])
    )
    users.push(...records.map(toUser).filter((user) => user !== null))
  }
  return users
}

export async function getAuthenticatedUser(token: string): Promise<TwitchUser | null> {
  const [record] = await helixList(token, 'users', [])
  return record ? toUser(record) : null
}

export async function getLiveStreams(token: string, logins: string[]): Promise<Map<string, TwitchStream>> {
  const streams = new Map<string, TwitchStream>()
  for (const group of chunk(logins)) {
    const records = await helixList(token, 'streams', [
      ['first', String(BATCH_SIZE)],
      ...group.map((login): [string, string] => ['user_login', login])
    ])
    for (const stream of records.map(toStream)) {
      if (stream) streams.set(stream.login, stream)
    }
  }
  return streams
}

export async function searchChannels(token: string, query: string): Promise<TwitchChannel[]> {
  const records = await helixList(token, 'search/channels', [
    ['query', query],
    ['first', '20']
  ])
  return records.flatMap((record) => {
    const login = readString(record, 'broadcaster_login')
    if (!login) return []
    return [
      {
        login,
        displayName: readString(record, 'display_name') ?? login,
        avatarUrl: readHttpsUrl(record, 'thumbnail_url'),
        isLive: readBoolean(record, 'is_live') ?? false
      }
    ]
  })
}

export async function getTeam(token: string, name: string): Promise<TwitchTeam | null> {
  const [record] = await helixList(token, 'teams', [['name', name]], [400, 404])
  if (!record) return null
  const teamName = readString(record, 'team_name')?.toLowerCase()
  if (!teamName) return null
  return {
    name: teamName,
    displayName: readString(record, 'team_display_name') ?? teamName,
    logoUrl: readHttpsUrl(record, 'thumbnail_url'),
    members: readRecords(record, 'users').flatMap((user) => {
      const id = readString(user, 'user_id')
      const login = readString(user, 'user_login')?.toLowerCase()
      if (!id || !login) return []
      return [{ id, login, displayName: readString(user, 'user_name') ?? login }]
    })
  }
}

export async function getChannelTeam(token: string, broadcasterId: string): Promise<TwitchTeamInfo | null> {
  const [record] = await helixList(token, 'teams/channel', [['broadcaster_id', broadcasterId]])
  if (!record) return null
  const name = readString(record, 'team_name')?.toLowerCase()
  if (!name) return null
  return {
    name,
    displayName: readString(record, 'team_display_name') ?? name,
    logoUrl: readHttpsUrl(record, 'thumbnail_url')
  }
}

export async function getLatestArchiveDate(token: string, userId: string): Promise<number | null> {
  const [video] = await helixList(token, 'videos', [
    ['user_id', userId],
    ['type', 'archive'],
    ['first', '1']
  ])
  return video ? readTimestamp(video, 'created_at') : null
}

export async function getNextScheduledStream(token: string, broadcasterId: string): Promise<number | null> {
  const body = await helix(token, 'schedule', [
    ['broadcaster_id', broadcasterId],
    ['first', '5']
  ])
  const data = body?.data
  if (!isRecord(data)) return null
  const now = Date.now()
  for (const segment of readRecords(data, 'segments')) {
    if (segment.canceled_until) continue
    const start = readTimestamp(segment, 'start_time')
    if (start !== null && start > now) return start
  }
  return null
}
