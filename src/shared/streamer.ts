import { isRecord, readBoolean, readHttpsUrl, readNumber, readString, readTimestamp } from './guards'

export interface Streamer {
  id: string
  login: string
  displayName: string
  twitchId: string | null
  avatarUrl: string | null
  profileCheckedAt: number | null
  team: string | null
  teamDisplayName: string | null
  teamLogoUrl: string | null
  teamCheckedAt: number | null
  addedAt: number
  isLive: boolean
  title: string | null
  game: string | null
  viewerCount: number | null
  thumbnailUrl: string | null
  startedAt: number | null
  lastLiveAt: number | null
  nextStreamAt: number | null
  vodCheckedAt: number | null
  scheduleCheckedAt: number | null
  notifiedAt: number | null
  snoozedUntil: number | null
}

export const RECENTLY_LIVE_WINDOW = 12 * 60 * 60 * 1000

const LOGIN_PATTERN = /^[a-z0-9_]{1,25}$/
const TEAM_PATTERN = /^[a-z0-9_-]{2,40}$/

export function isValidLogin(value: string): boolean {
  return LOGIN_PATTERN.test(value)
}

export function isValidTeamName(value: string): boolean {
  return TEAM_PATTERN.test(value)
}

export type ParsedInput = { kind: 'streamer'; login: string } | { kind: 'team'; name: string }

export function parseAddInput(input: string): ParsedInput | null {
  const value = input.trim().toLowerCase()
  const teamMatch = /^(?:(?:https?:\/\/)?(?:www\.)?twitch\.tv\/team\/|team\/)([a-z0-9_-]+)/.exec(value)
  if (teamMatch?.[1]) {
    return isValidTeamName(teamMatch[1]) ? { kind: 'team', name: teamMatch[1] } : null
  }
  const urlMatch = /^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([a-z0-9_]+)/.exec(value)
  const login = urlMatch?.[1] ?? value.replace(/^@/, '')
  return isValidLogin(login) ? { kind: 'streamer', login } : null
}

export function createStreamer(profile: {
  login: string
  displayName: string
  twitchId: string | null
  avatarUrl: string | null
}): Streamer {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    login: profile.login,
    displayName: profile.displayName,
    twitchId: profile.twitchId,
    avatarUrl: profile.avatarUrl,
    profileCheckedAt: profile.twitchId ? now : null,
    team: null,
    teamDisplayName: null,
    teamLogoUrl: null,
    teamCheckedAt: null,
    addedAt: now,
    isLive: false,
    title: null,
    game: null,
    viewerCount: null,
    thumbnailUrl: null,
    startedAt: null,
    lastLiveAt: null,
    nextStreamAt: null,
    vodCheckedAt: null,
    scheduleCheckedAt: null,
    notifiedAt: null,
    snoozedUntil: null
  }
}

export function normalizeStreamer(raw: unknown): Streamer | null {
  if (!isRecord(raw)) return null
  const login = (readString(raw, 'login') ?? readString(raw, 'username'))?.toLowerCase()
  if (!login || !isValidLogin(login)) return null
  const team = readString(raw, 'team')?.trim().toLowerCase() ?? null

  return {
    id: readString(raw, 'id') ?? crypto.randomUUID(),
    login,
    displayName: readString(raw, 'displayName') ?? readString(raw, 'name') ?? login,
    twitchId: readString(raw, 'twitchId'),
    avatarUrl: readHttpsUrl(raw, 'avatarUrl') ?? readHttpsUrl(raw, 'avatar'),
    profileCheckedAt: readNumber(raw, 'profileCheckedAt'),
    team,
    teamDisplayName: team ? readString(raw, 'teamDisplayName') : null,
    teamLogoUrl: team ? (readHttpsUrl(raw, 'teamLogoUrl') ?? readHttpsUrl(raw, 'teamLogo')) : null,
    teamCheckedAt: readNumber(raw, 'teamCheckedAt'),
    addedAt: readNumber(raw, 'addedAt') ?? readNumber(raw, 'addedDate') ?? Date.now(),
    isLive: readBoolean(raw, 'isLive') ?? false,
    title: readString(raw, 'title'),
    game: readString(raw, 'game'),
    viewerCount: readNumber(raw, 'viewerCount'),
    thumbnailUrl: readHttpsUrl(raw, 'thumbnailUrl') ?? readHttpsUrl(raw, 'thumbnail'),
    startedAt: readTimestamp(raw, 'startedAt'),
    lastLiveAt: readNumber(raw, 'lastLiveAt') ?? readNumber(raw, 'lastLiveDate'),
    nextStreamAt: readNumber(raw, 'nextStreamAt'),
    vodCheckedAt: readNumber(raw, 'vodCheckedAt'),
    scheduleCheckedAt: readNumber(raw, 'scheduleCheckedAt'),
    notifiedAt: readNumber(raw, 'notifiedAt'),
    snoozedUntil: readNumber(raw, 'snoozedUntil')
  }
}

export function isRecentlyLive(streamer: Streamer, now = Date.now()): boolean {
  return !streamer.isLive && streamer.lastLiveAt !== null && now - streamer.lastLiveAt < RECENTLY_LIVE_WINDOW
}

export function isSnoozed(streamer: Streamer, now = Date.now()): boolean {
  return streamer.snoozedUntil !== null && streamer.snoozedUntil > now
}

export function teamLabel(streamer: Streamer): string | null {
  if (!streamer.team) return null
  return streamer.teamDisplayName ?? streamer.team.charAt(0).toUpperCase() + streamer.team.slice(1)
}

export function sortStreamers(streamers: Streamer[]): Streamer[] {
  const activityTime = (streamer: Streamer): number =>
    streamer.isLive ? (streamer.startedAt ?? streamer.lastLiveAt ?? 0) : (streamer.lastLiveAt ?? 0)

  return [...streamers].sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
    return activityTime(b) - activityTime(a)
  })
}
