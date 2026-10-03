import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { groupNames, notifyLives, openNotification } from '../src/background/notifier'
import { createStreamer } from '../src/shared/streamer'

function streamer(login: string) {
  return createStreamer({ login, displayName: login, twitchId: null, avatarUrl: null })
}

describe('groupNames', () => {
  it('lists up to four names in a sentence', () => {
    expect(groupNames(['ZeratoR', 'Kamet0', 'Ponce'], 'fr')).toEqual({
      listed: 'ZeratoR, Kamet0 et Ponce',
      hidden: 0
    })
    expect(groupNames(['ZeratoR', 'Kamet0', 'Ponce'], 'en')).toEqual({
      listed: 'ZeratoR, Kamet0, and Ponce',
      hidden: 0
    })
  })

  it('keeps three names and counts the rest beyond four', () => {
    expect(groupNames(['a', 'b', 'c', 'd', 'e', 'f'], 'fr')).toEqual({ listed: 'a, b, c', hidden: 3 })
  })
})

describe('notifyLives', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.spyOn(fakeBrowser.i18n, 'getMessage').mockImplementation((key: string) => key)
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('fr')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends one notification per streamer below three', async () => {
    const create = vi.spyOn(fakeBrowser.notifications, 'create').mockResolvedValue('id' as never)
    await notifyLives([streamer('zerator'), streamer('ponce')], false)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('groups three streamers or more into a single notification', async () => {
    const create = vi.spyOn(fakeBrowser.notifications, 'create').mockResolvedValue('id' as never)
    await notifyLives([streamer('zerator'), streamer('ponce'), streamer('kamet0')], false)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]?.[0]).toEqual(expect.stringMatching(/^group:zerator:/))
  })

  it('opens the popup from a grouped notification, or the first stream when Chrome refuses', async () => {
    vi.spyOn(fakeBrowser.notifications, 'clear').mockResolvedValue()
    vi.spyOn(fakeBrowser.action, 'openPopup').mockRejectedValue(new Error('no window'))
    const create = vi.spyOn(fakeBrowser.tabs, 'create')
    await openNotification('group:zerator:123')
    expect(create).toHaveBeenCalledWith({ url: 'https://www.twitch.tv/zerator' })
  })
})
