import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { checkAllStreamers, scheduleChecks } from '../background/checker'
import { CHECK_ALARM } from '../background/config'
import { openNotification } from '../background/notifier'
import { routeMessage } from '../background/router'

const LEGACY_LOCAL_KEYS = /^(avatar_|thumbnail_|teamLogo_)|^(notifiedStreamers|notificationUrls|history)$/

async function removeLegacyStorage(): Promise<void> {
  const stored = await browser.storage.local.get(null)
  const legacyKeys = Object.keys(stored).filter((key) => LEGACY_LOCAL_KEYS.test(key))
  if (legacyKeys.length > 0) await browser.storage.local.remove(legacyKeys)
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'update') void removeLegacyStorage()
    void checkAllStreamers()
  })
  browser.runtime.onStartup.addListener(() => {
    void checkAllStreamers()
  })
  browser.alarms.onAlarm.addListener(({ name }) => {
    if (name === CHECK_ALARM) void checkAllStreamers()
  })
  browser.notifications.onClicked.addListener((notificationId) => {
    void openNotification(notificationId)
  })
  browser.runtime.onMessage.addListener(routeMessage)
  void scheduleChecks(0)
})
