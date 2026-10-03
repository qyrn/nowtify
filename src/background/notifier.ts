import { browser } from 'wxt/browser'
import { tomorrowMorning } from '../shared/snooze'
import type { Streamer } from '../shared/streamer'
import { getAllStreamers, patchStreamers } from './database'

const PREFIX = 'live:'
const GROUP_PREFIX = 'group:'
const GROUP_THRESHOLD = 3
const GROUP_LISTED = 3
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

async function notifyLive(streamer: Streamer, persistent: boolean): Promise<void> {
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

export function groupNames(names: string[], locale: string): { listed: string; hidden: number } {
  if (names.length <= GROUP_LISTED + 1) {
    return { listed: new Intl.ListFormat(locale, { type: 'conjunction' }).format(names), hidden: 0 }
  }
  return { listed: names.slice(0, GROUP_LISTED).join(', '), hidden: names.length - GROUP_LISTED }
}

async function notifyLiveGroup(streamers: Streamer[], persistent: boolean): Promise<void> {
  const [first] = streamers
  if (!first) return
  const { listed, hidden } = groupNames(
    streamers.map((streamer) => streamer.displayName),
    browser.i18n.getUILanguage()
  )
  await browser.notifications
    .create(`${GROUP_PREFIX}${first.login}:${String(Date.now())}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon-128.png'),
      title: browser.i18n.getMessage('notificationGroupTitle', [String(streamers.length)]),
      message:
        hidden > 0 ? browser.i18n.getMessage('notificationGroupMore', [listed, String(hidden)]) : listed,
      priority: 2,
      requireInteraction: persistent
    })
    .catch((error: unknown) => {
      console.error('[Nowtify] notification failed', error)
    })
}

export async function notifyLives(streamers: Streamer[], persistent: boolean): Promise<void> {
  if (streamers.length >= GROUP_THRESHOLD) await notifyLiveGroup(streamers, persistent)
  else await Promise.all(streamers.map((streamer) => notifyLive(streamer, persistent)))
}

function loginFrom(notificationId: string): string | null {
  const prefix = [PREFIX, GROUP_PREFIX].find((candidate) => notificationId.startsWith(candidate))
  if (!prefix) return null
  return notificationId.slice(prefix.length).split(':')[0] ?? null
}

async function openPopupOrStream(login: string): Promise<void> {
  try {
    await browser.action.openPopup()
  } catch {
    await browser.tabs.create({ url: `https://www.twitch.tv/${login}` })
  }
}

async function snoozeUntilTomorrow(login: string): Promise<void> {
  const streamer = (await getAllStreamers()).find((candidate) => candidate.login === login)
  if (!streamer) return
  await patchStreamers(new Map([[streamer.id, { snoozedUntil: tomorrowMorning() }]]))
}

export async function openNotification(notificationId: string): Promise<void> {
  const login = loginFrom(notificationId)
  if (!login) return
  if (notificationId.startsWith(GROUP_PREFIX)) await openPopupOrStream(login)
  else await browser.tabs.create({ url: `https://www.twitch.tv/${login}` })
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
