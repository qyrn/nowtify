import { browser } from 'wxt/browser'
import { tomorrowMorning } from '../shared/snooze'
import type { Streamer } from '../shared/streamer'
import { getAllStreamers, patchStreamers } from './database'

const PREFIX = 'live:'
const WATCH_BUTTON = 0
const SNOOZE_BUTTON = 1

async function createNotification(id: string, streamer: Streamer, iconUrl: string, persistent: boolean) {
  await browser.notifications.create(id, {
    type: 'basic',
    iconUrl,
    title: browser.i18n.getMessage('notificationTitle', [streamer.displayName]),
    message: streamer.title ?? browser.i18n.getMessage('notificationBodyFallback', [streamer.displayName]),
    contextMessage: streamer.game ?? '',
    priority: 2,
    requireInteraction: persistent,
    buttons: [
      { title: browser.i18n.getMessage('notificationWatchButton') },
      { title: browser.i18n.getMessage('notificationSnoozeButton') }
    ]
  })
}

export async function notifyLive(streamer: Streamer, persistent: boolean): Promise<void> {
  const id = `${PREFIX}${streamer.login}:${Date.now()}`
  const fallbackIcon = browser.runtime.getURL('/icon-128.png')
  try {
    await createNotification(id, streamer, streamer.avatarUrl ?? fallbackIcon, persistent)
  } catch {
    await createNotification(id, streamer, fallbackIcon, persistent).catch((error: unknown) => {
      console.error('[Nowtify] notification failed', error)
    })
  }
}

function loginFrom(notificationId: string): string | null {
  if (!notificationId.startsWith(PREFIX)) return null
  return notificationId.slice(PREFIX.length).split(':')[0] ?? null
}

async function snoozeUntilTomorrow(login: string): Promise<void> {
  const streamer = (await getAllStreamers()).find((candidate) => candidate.login === login)
  if (!streamer) return
  await patchStreamers(new Map([[streamer.id, { snoozedUntil: tomorrowMorning() }]]))
}

export async function openNotification(notificationId: string): Promise<void> {
  const login = loginFrom(notificationId)
  if (!login) return
  await browser.tabs.create({ url: `https://www.twitch.tv/${login}` })
  await browser.notifications.clear(notificationId)
}

export async function handleNotificationButton(notificationId: string, buttonIndex: number): Promise<void> {
  const login = loginFrom(notificationId)
  if (!login) return
  if (buttonIndex === WATCH_BUTTON) await openNotification(notificationId)
  if (buttonIndex === SNOOZE_BUTTON) {
    await snoozeUntilTomorrow(login)
    await browser.notifications.clear(notificationId)
  }
}
