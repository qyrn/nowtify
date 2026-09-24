import { browser } from 'wxt/browser'
import { isRecord } from './guards'
import type { HistoryEntry } from './history'
import type { Streamer } from './streamer'
import type { Backup } from './backup'

export interface TwitchProfile {
  id: string
  login: string
  displayName: string
  avatarUrl: string | null
}

export type AuthState =
  { status: 'connected'; user: TwitchProfile | null } | { status: 'expired' } | { status: 'disconnected' }

export interface ChannelSuggestion {
  login: string
  displayName: string
  avatarUrl: string | null
  isLive: boolean
}

export interface TeamSuggestion {
  name: string
  displayName: string
  logoUrl: string | null
  memberCount: number
}

export type AddStreamerResult =
  | { status: 'added'; streamer: Streamer }
  | { status: 'duplicate' }
  | { status: 'notFound' }
  | { status: 'disconnected' }

export type AddTeamResult =
  | { status: 'added'; displayName: string; added: number }
  | { status: 'notFound' }
  | { status: 'empty' }
  | { status: 'disconnected' }

export interface ImportResult {
  streamersAdded: number
  historyAdded: number
}

export interface MessageMap {
  getStreamers: { request: null; response: Streamer[] }
  refresh: { request: null; response: Streamer[] }
  addStreamer: { request: { login: string }; response: AddStreamerResult }
  addTeam: { request: { name: string }; response: AddTeamResult }
  deleteStreamer: { request: { id: string }; response: null }
  deleteTeam: { request: { team: string }; response: null }
  setSnooze: { request: { id: string; until: number | null }; response: null }
  searchChannels: { request: { query: string }; response: ChannelSuggestion[] }
  findTeam: { request: { name: string }; response: TeamSuggestion | null }
  getHistory: { request: { limit: number }; response: HistoryEntry[] }
  clearHistory: { request: null; response: null }
  getAuthState: { request: null; response: AuthState }
  login: { request: null; response: TwitchProfile }
  logout: { request: null; response: null }
  exportBackup: { request: null; response: Backup }
  importBackup: { request: { backup: unknown }; response: ImportResult }
}

export type MessageType = keyof MessageMap
export type MessageRequest<K extends MessageType> = MessageMap[K]['request']
export type MessageResponse<K extends MessageType> = MessageMap[K]['response']

export interface Envelope {
  type: MessageType
  payload: unknown
}

export type Reply = { ok: true; data: unknown } | { ok: false; error: string }

const MESSAGE_TYPES: readonly MessageType[] = [
  'getStreamers',
  'refresh',
  'addStreamer',
  'addTeam',
  'deleteStreamer',
  'deleteTeam',
  'setSnooze',
  'searchChannels',
  'findTeam',
  'getHistory',
  'clearHistory',
  'getAuthState',
  'login',
  'logout',
  'exportBackup',
  'importBackup'
]

export function isEnvelope(value: unknown): value is Envelope {
  return isRecord(value) && MESSAGE_TYPES.some((type) => type === value.type)
}

function isReply(value: unknown): value is Reply {
  return isRecord(value) && typeof value.ok === 'boolean'
}

export async function send<K extends MessageType>(
  type: K,
  payload: MessageRequest<K>
): Promise<MessageResponse<K>> {
  const envelope: Envelope = { type, payload }
  const reply: unknown = await browser.runtime.sendMessage(envelope)
  if (!isReply(reply)) throw new Error(`No reply for ${type}`)
  if (!reply.ok) throw new Error(reply.error)
  return reply.data as MessageResponse<K>
}
