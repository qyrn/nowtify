import { browser } from 'wxt/browser'
import { loadSettings } from '../shared/settings'
import { isSnoozed, type Streamer } from '../shared/streamer'
import {
  CHECK_ALARM,
  CHECK_PERIOD_MINUTES,
  CHECK_PERIOD_MINUTES_WHILE_LIVE,
  NOTIFICATION_COOLDOWN,
  PROFILE_RECHECK_INTERVAL,
  SCHEDULE_RECHECK_INTERVAL,
  TEAM_RECHECK_INTERVAL,
  VOD_RECHECK_INTERVAL
} from './config'
import { addHistoryEntry, closeHistoryEntry, getAllStreamers, patchStreamers } from './database'
import { notifyLive } from './notifier'
import { getToken, invalidateToken } from './twitch-auth'
import {
  getChannelTeam,
  getLatestArchiveDate,
  getLiveStreams,
  getNextScheduledStream,
  getUsersByLogin,
  TwitchAuthError,
  type TwitchStream
} from './twitch-api'

let runningCheck: Promise<void> | null = null

const isDue = (checkedAt: number | null, interval: number, now: number): boolean =>
  checkedAt === null || now - checkedAt > interval

export async function scheduleChecks(liveCount: number): Promise<void> {
  const period = liveCount > 0 ? CHECK_PERIOD_MINUTES_WHILE_LIVE : CHECK_PERIOD_MINUTES
  const alarm = await browser.alarms.get(CHECK_ALARM)
  if (alarm?.periodInMinutes !== period) {
    await browser.alarms.create(CHECK_ALARM, { periodInMinutes: period })
  }
}

async function updateBadge(liveCount: number): Promise<void> {
  await browser.action.setBadgeText({ text: liveCount > 0 ? String(Math.min(liveCount, 99)) : '' })
  await browser.action.setBadgeBackgroundColor({ color: '#FCD34D' })
  await browser.action.setBadgeTextColor({ color: '#0E0E10' })
}

async function refreshProfiles(token: string, streamers: Streamer[], now: number): Promise<void> {
  const stale = streamers.filter(
    (streamer) =>
      !streamer.twitchId ||
      !streamer.avatarUrl ||
      isDue(streamer.profileCheckedAt, PROFILE_RECHECK_INTERVAL, now)
  )
  if (stale.length === 0) return
  const users = await getUsersByLogin(
    token,
    stale.map((streamer) => streamer.login)
  )
  const byLogin = new Map(users.map((user) => [user.login, user]))
  for (const streamer of stale) {
    const user = byLogin.get(streamer.login)
    streamer.profileCheckedAt = now
    if (!user) continue
    streamer.twitchId = user.id
    streamer.displayName = user.displayName
    streamer.avatarUrl = user.avatarUrl
  }
}

export function applyLiveState(streamer: Streamer, stream: TwitchStream | undefined, now: number): void {
  if (stream) {
    streamer.isLive = true
    streamer.title = stream.title
    streamer.game = stream.game
    streamer.viewerCount = stream.viewerCount
    streamer.thumbnailUrl = stream.thumbnailUrl
    streamer.startedAt = stream.startedAt ?? streamer.startedAt ?? now
    streamer.lastLiveAt = now
    streamer.nextStreamAt = null
    return
  }
  if (streamer.isLive) streamer.lastLiveAt = now
  streamer.isLive = false
  streamer.viewerCount = null
  streamer.thumbnailUrl = null
}

async function enrichOffline(token: string, streamer: Streamer, now: number): Promise<void> {
  if (!streamer.twitchId) return

  if (isDue(streamer.vodCheckedAt, VOD_RECHECK_INTERVAL, now)) {
    const archivedAt = await getLatestArchiveDate(token, streamer.twitchId)
    streamer.vodCheckedAt = now
    if (archivedAt !== null && archivedAt > (streamer.lastLiveAt ?? 0)) streamer.lastLiveAt = archivedAt
  }

  if (isDue(streamer.scheduleCheckedAt, SCHEDULE_RECHECK_INTERVAL, now)) {
    streamer.nextStreamAt = await getNextScheduledStream(token, streamer.twitchId)
    streamer.scheduleCheckedAt = now
  }
}

async function enrichTeam(token: string, streamer: Streamer, now: number): Promise<void> {
  if (streamer.team || !streamer.twitchId || !isDue(streamer.teamCheckedAt, TEAM_RECHECK_INTERVAL, now))
    return
  const team = await getChannelTeam(token, streamer.twitchId)
  streamer.teamCheckedAt = now
  if (!team) return
  streamer.team = team.name
  streamer.teamDisplayName = team.displayName
  streamer.teamLogoUrl = team.logoUrl
}

async function recordTransitions(previous: Streamer, next: Streamer, now: number): Promise<void> {
  if (next.isLive && !previous.isLive) {
    await addHistoryEntry({
      streamerId: next.id,
      displayName: next.displayName,
      title: next.title,
      game: next.game,
      viewerCount: next.viewerCount,
      timestamp: now,
      startedAt: next.startedAt,
      endedAt: null
    })
  }
  if (!next.isLive && previous.isLive) await closeHistoryEntry(next.id, now)
}

async function shouldNotify(previous: Streamer, next: Streamer, now: number): Promise<boolean> {
  if (!next.isLive || previous.isLive || isSnoozed(next, now)) return false
  if (next.notifiedAt !== null && now - next.notifiedAt < NOTIFICATION_COOLDOWN) return false
  return (await loadSettings()).notifications
}

function checkOwnedFields(streamer: Streamer): Partial<Streamer> {
  const { id, snoozedUntil, addedAt, ...fields } = streamer
  return fields
}

async function runCheck(): Promise<void> {
  const streamers = await getAllStreamers()
  if (streamers.length === 0) {
    await updateBadge(0)
    await scheduleChecks(0)
    return
  }

  const token = await getToken()
  if (!token) {
    await updateBadge(0)
    return
  }

  const now = Date.now()
  const nextStates = streamers.map((streamer) => ({ ...streamer }))
  await refreshProfiles(token, nextStates, now)
  const liveStreams = await getLiveStreams(
    token,
    nextStates.map((streamer) => streamer.login)
  )

  const patches = new Map<string, Partial<Streamer>>()
  const toNotify: Streamer[] = []

  for (const [index, next] of nextStates.entries()) {
    const previous = streamers[index]
    if (!previous) continue
    applyLiveState(next, liveStreams.get(next.login), now)
    try {
      await enrichTeam(token, next, now)
      if (!next.isLive) await enrichOffline(token, next, now)
    } catch (error) {
      if (error instanceof TwitchAuthError) throw error
    }
    if (await shouldNotify(previous, next, now)) {
      next.notifiedAt = now
      toNotify.push(next)
    }
    await recordTransitions(previous, next, now)
    patches.set(next.id, checkOwnedFields(next))
  }

  await patchStreamers(patches)
  const persistent = (await loadSettings()).persistentNotifications
  await Promise.all(toNotify.map((streamer) => notifyLive(streamer, persistent)))

  const liveCount = nextStates.filter((streamer) => streamer.isLive).length
  await updateBadge(liveCount)
  await scheduleChecks(liveCount)
  await browser.storage.session.set({ authExpired: false })
  await browser.storage.local.set({ lastCheckAt: now })
}

export function checkAllStreamers(): Promise<void> {
  runningCheck ??= runCheck()
    .catch(async (error: unknown) => {
      if (error instanceof TwitchAuthError) {
        await invalidateToken()
        return
      }
      console.error('[Nowtify] check failed', error)
    })
    .finally(() => {
      runningCheck = null
    })
  return runningCheck
}
