import { browser } from 'wxt/browser'
import type { Streamer } from '../shared/streamer'

const PREFIX = 'live:'

async function createNotification(id: string, streamer: Streamer, iconUrl: string, persistent: boolean) {
  await browser.notifications.create(id, {
    type: 'basic',
    iconUrl,
    title: browser.i18n.getMessage('notificationTitle', [streamer.displayName]),
    message: streamer.title ?? browser.i18n.getMessage('notificationBodyFallback', [streamer.displayName]),
    contextMessage: streamer.game ?? '',
    priority: 2,
    requireInteraction: persistent
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

export async function openNotification(notificationId: string): Promise<void> {
  if (!notificationId.startsWith(PREFIX)) return
  const login = notificationId.slice(PREFIX.length).split(':')[0]
  if (login) await browser.tabs.create({ url: `https://www.twitch.tv/${login}` })
  await browser.notifications.clear(notificationId)
}
