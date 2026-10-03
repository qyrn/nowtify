import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { getAllStreamers, putStreamers } from '../src/background/database'
import { handleNotificationButton } from '../src/background/notifier'
import { tomorrowMorning } from '../src/shared/snooze'
import { createStreamer } from '../src/shared/streamer'

describe('tomorrowMorning', () => {
  it('points to 9:00 the next day', () => {
    const morning = new Date(tomorrowMorning(new Date(2026, 9, 3, 22, 15)))
    expect([morning.getDate(), morning.getHours(), morning.getMinutes()]).toEqual([4, 9, 0])
  })
})

describe('notification buttons', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    vi.spyOn(fakeBrowser.notifications, 'clear').mockResolvedValue()
    await putStreamers([
      {
        ...createStreamer({ login: 'kamet0', displayName: 'Kamet0', twitchId: '42', avatarUrl: null }),
        id: 'k'
      }
    ])
  })

  it('pauses the streamer until tomorrow morning', async () => {
    await handleNotificationButton('live:kamet0:123', 1)
    const [streamer] = await getAllStreamers()
    expect(streamer?.snoozedUntil).toBe(tomorrowMorning())
  })

  it('opens the stream with the watch button', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create')
    await handleNotificationButton('live:kamet0:123', 0)
    expect(create).toHaveBeenCalledWith({ url: 'https://www.twitch.tv/kamet0' })
  })

  it('ignores notifications that are not about a live', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create')
    await handleNotificationButton('other:123', 0)
    expect(create).not.toHaveBeenCalled()
  })
})
