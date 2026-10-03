import '../../styles/base.css'
import '../../styles/popup.css'
import { browser } from 'wxt/browser'
import { AddForm } from '../../popup/add-form'
import { closeSnoozeMenus, openSnoozeMenu, type PauseChoice } from '../../popup/snooze-menu'
import { StreamerList } from '../../popup/streamer-list'
import { TeamFilter } from '../../popup/team-filter'
import { byId } from '../../shared/dom'
import { plural, t, translatePage } from '../../shared/i18n'
import { send, type AuthState } from '../../shared/messages'
import { loadSettings } from '../../shared/settings'
import { followThemeSetting } from '../../shared/theme'
import { sortStreamers, teamLabel, type Streamer } from '../../shared/streamer'
import { confirmDanger, dialog, toast } from '../../shared/ui'

const settingsButton = byId('settingsBtn', HTMLButtonElement)
const authBanner = byId('authBanner', HTMLDivElement)
const authBannerText = byId('authBannerText', HTMLSpanElement)
const authBannerButton = byId('authBannerBtn', HTMLButtonElement)
const listElement = byId('streamerList', HTMLDivElement)
const emptyState = byId('emptyState', HTMLDivElement)
const toolbar = byId('toolbar', HTMLDivElement)
const followedCount = byId('followedCount', HTMLSpanElement)
const liveLed = byId('liveLed', HTMLSpanElement)
const liveLedText = byId('liveLedText', HTMLSpanElement)

let streamers: Streamer[] = []
let refreshing = false

const teamFilter = new TeamFilter(render)
const list = new StreamerList(listElement, {
  open: (streamer) => {
    void browser.tabs.create({ url: `https://www.twitch.tv/${streamer.login}` })
  },
  snooze: (streamer, card) => {
    openSnoozeMenu(streamer, card, (choice) => {
      void pause(streamer, choice)
    })
  },
  remove: (streamer) => {
    void remove(streamer)
  }
})
const addForm = new AddForm(reload)

function render(): void {
  const sorted = sortStreamers(streamers)
  teamFilter.update(sorted)
  list.render(teamFilter.apply(sorted))
  const live = streamers.filter((streamer) => streamer.isLive).length
  liveLed.classList.toggle('hidden', live === 0)
  liveLedText.textContent = t('liveLed', live)
  toolbar.classList.toggle('hidden', streamers.length === 0)
  followedCount.textContent = plural(streamers.length, 'followedCount', 'followedCountPlural')
  emptyState.classList.toggle('hidden', streamers.length > 0)
}

async function reload(): Promise<void> {
  streamers = await send('getStreamers', null)
  render()
}

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    streamers = await send('refresh', null)
    render()
    renderAuth(await send('getAuthState', null))
  } catch {
    toast(t('loadErrorText'), 'error')
  } finally {
    refreshing = false
  }
}

function renderAuth(state: AuthState): void {
  authBanner.classList.toggle('hidden', state.status === 'connected')
  if (state.status === 'connected') return
  authBannerText.textContent = t(state.status === 'expired' ? 'authExpiredText' : 'twitchConnectRequiredText')
  authBannerButton.textContent = t(state.status === 'expired' ? 'reconnectButton' : 'connectButton')
  if (streamers.length === 0) addForm.focus()
}

async function connect(): Promise<void> {
  authBannerButton.disabled = true
  try {
    await send('login', null)
    renderAuth({ status: 'connected', user: null })
    toast(t('twitchConnectedToast'), 'success')
    await refresh()
  } catch (error) {
    toast(error instanceof Error ? error.message : t('unknownError'), 'error')
  } finally {
    authBannerButton.disabled = false
  }
}

function pauseToast(streamer: Streamer, choice: PauseChoice): string {
  if (choice.muted) return t('muteToast', streamer.displayName)
  return choice.snoozedUntil ? t('snoozeToastPaused') : t('snoozeToastResumed')
}

async function pause(streamer: Streamer, choice: PauseChoice): Promise<void> {
  await send('setPause', { ids: [streamer.id], ...choice })
  toast(pauseToast(streamer, choice), 'success')
  await reload()
}

async function remove(streamer: Streamer): Promise<void> {
  const { confirmDelete } = await loadSettings()
  const team = teamLabel(streamer)

  if (streamer.team && team) {
    const choice = confirmDelete
      ? await dialog(t('deleteStreamerModalTitle'), t('deleteModalTeamText', streamer.displayName, team), [
          { label: t('deleteWholeTeam'), value: 'team' as const, variant: 'danger' },
          { label: t('deleteThisStreamer'), value: 'streamer' as const, variant: 'primary' }
        ])
      : 'streamer'
    if (choice === 'team') await send('deleteTeam', { team: streamer.team })
    if (choice === 'streamer') await send('deleteStreamer', { id: streamer.id })
  } else {
    const confirmed =
      !confirmDelete ||
      (await confirmDanger(
        t('deleteStreamerModalTitle'),
        t('confirmRemoveStreamerText', streamer.displayName),
        t('deleteTitle')
      ))
    if (confirmed) await send('deleteStreamer', { id: streamer.id })
  }
  await reload()
}

async function start(): Promise<void> {
  translatePage()
  void followThemeSetting()
  settingsButton.addEventListener('click', () => void browser.runtime.openOptionsPage())
  authBannerButton.addEventListener('click', () => void connect())
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && !event.target.closest('.card-snooze, .snooze-menu'))
      closeSnoozeMenus()
  })
  browser.storage.local.onChanged.addListener((changes) => {
    if ('lastCheckAt' in changes) void reload()
  })
  setInterval(render, 60_000)

  await reload()
  renderAuth(await send('getAuthState', null))
  await refresh()
}

void start()
