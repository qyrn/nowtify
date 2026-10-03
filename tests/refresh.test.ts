import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { refreshIfStale } from '../src/background/checker'
import { CHECK_ALARM, POPUP_REFRESH_MIN_INTERVAL } from '../src/background/config'

const NOW = 1_000_000_000

describe('refreshIfStale', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('skips the check when the last one is recent', async () => {
    await fakeBrowser.storage.local.set({ lastCheckAt: NOW - POPUP_REFRESH_MIN_INTERVAL + 1 })
    await refreshIfStale(NOW)
    expect(await fakeBrowser.alarms.get(CHECK_ALARM)).toBeFalsy()
  })

  it('checks again once the last check is old enough', async () => {
    await fakeBrowser.storage.local.set({ lastCheckAt: NOW - POPUP_REFRESH_MIN_INTERVAL })
    await refreshIfStale(NOW)
    expect(await fakeBrowser.alarms.get(CHECK_ALARM)).toBeTruthy()
  })
})
