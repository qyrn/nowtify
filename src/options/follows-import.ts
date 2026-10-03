import { byId, h } from '../shared/dom'
import { plural, t } from '../shared/i18n'
import { send, type FollowedChannelChoice, type FollowsResult } from '../shared/messages'
import { toast } from '../shared/ui'

const openButton = byId('followsOpenBtn', HTMLButtonElement)
const panel = byId('followsPanel', HTMLDivElement)
const summary = byId('followsSummary', HTMLSpanElement)
const filterInput = byId('followsFilter', HTMLInputElement)
const toggleAllButton = byId('followsToggleAll', HTMLButtonElement)
const list = byId('followsList', HTMLUListElement)
const addButton = byId('followsAddBtn', HTMLButtonElement)
const cancelButton = byId('followsCancelBtn', HTMLButtonElement)

const selected = new Set<string>()
let channels: FollowedChannelChoice[] = []

function available(): FollowedChannelChoice[] {
  return channels.filter((channel) => !channel.added)
}

function refreshControls(): void {
  addButton.textContent = t('followsAdd', selected.size)
  addButton.disabled = selected.size === 0
  const allSelected = available().length > 0 && available().every((channel) => selected.has(channel.login))
  toggleAllButton.textContent = t(allSelected ? 'followsSelectNone' : 'followsSelectAll')
  toggleAllButton.disabled = available().length === 0
}

function row(channel: FollowedChannelChoice): HTMLElement {
  const checkbox = h('input', {
    type: 'checkbox',
    checked: channel.added || selected.has(channel.login),
    disabled: channel.added
  })
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selected.add(channel.login)
    else selected.delete(channel.login)
    refreshControls()
  })
  return h('li', {}, [
    h('label', { class: channel.added ? 'follow-row added' : 'follow-row' }, [
      checkbox,
      h('span', { class: 'follow-name' }, [channel.displayName]),
      channel.added ? h('span', { class: 'follow-added' }, [t('followsAlreadyAdded')]) : null
    ])
  ])
}

function renderList(): void {
  const query = filterInput.value.trim().toLowerCase()
  const visible = channels.filter(
    (channel) => !query || channel.login.includes(query) || channel.displayName.toLowerCase().includes(query)
  )
  list.replaceChildren(...visible.map(row))
  refreshControls()
}

function show(result: Extract<FollowsResult, { status: 'ok' }>): void {
  channels = result.channels
  selected.clear()
  filterInput.value = ''
  if (channels.length === 0) {
    toast(t('followsEmpty'), 'info')
    return
  }
  summary.textContent = t('followsSummary', available().length, channels.length)
  panel.classList.remove('hidden')
  renderList()
}

async function loadFollows(): Promise<FollowsResult> {
  const result = await send('getTwitchFollows', null)
  if (result.status !== 'needsAccess') return result
  if (!(await send('requestFollowsAccess', null))) return result
  return send('getTwitchFollows', null)
}

async function open(): Promise<void> {
  openButton.disabled = true
  try {
    const result = await loadFollows()
    if (result.status === 'ok') show(result)
    if (result.status === 'needsAccess') toast(t('followsAccessDenied'), 'error')
    if (result.status === 'disconnected') toast(t('twitchConnectRequiredText'), 'error')
  } catch {
    toast(t('followsLoadError'), 'error')
  } finally {
    openButton.disabled = false
  }
}

async function addSelected(): Promise<void> {
  addButton.disabled = true
  try {
    const added = await send('importStreamers', { logins: [...selected] })
    toast(plural(added, 'followsImportedToast', 'followsImportedToastPlural'), 'success')
    panel.classList.add('hidden')
  } catch {
    toast(t('addErrorGeneric'), 'error')
    refreshControls()
  }
}

export function setupFollowsImport(): void {
  openButton.addEventListener('click', () => void open())
  filterInput.addEventListener('input', renderList)
  toggleAllButton.addEventListener('click', () => {
    const allSelected = available().every((channel) => selected.has(channel.login))
    for (const channel of available()) {
      if (allSelected) selected.delete(channel.login)
      else selected.add(channel.login)
    }
    renderList()
  })
  addButton.addEventListener('click', () => void addSelected())
  cancelButton.addEventListener('click', () => {
    panel.classList.add('hidden')
  })
}
