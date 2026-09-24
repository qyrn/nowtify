import { byId, h } from '../shared/dom'
import { formatAgo, formatDuration } from '../shared/format'
import { computeStats, streamDuration, type HistoryEntry } from '../shared/history'
import { plural, t } from '../shared/i18n'
import { icon } from '../shared/icons'
import { send } from '../shared/messages'
import { confirmDanger, toast } from '../shared/ui'

const HISTORY_SHOWN = 15

const statsGrid = byId('stats', HTMLDivElement)
const historyList = byId('history', HTMLOListElement)
const clearButton = byId('clearHistoryBtn', HTMLButtonElement)

function statCard(value: string, label: string, detail: string | null): HTMLElement {
  return h('div', { class: 'stat' }, [
    h('span', { class: 'stat-value', title: value }, [value]),
    h('span', { class: 'stat-label' }, [label]),
    detail ? h('span', { class: 'stat-detail' }, [detail]) : null
  ])
}

function renderStats(history: HistoryEntry[]): void {
  if (history.length === 0) {
    statsGrid.replaceChildren(h('p', { class: 'empty' }, [t('statsNoData')]))
    return
  }
  const stats = computeStats(history)
  statsGrid.replaceChildren(
    statCard(String(stats.total), t('statStreamsCaught'), t('statStreamsCaughtSub')),
    statCard(String(stats.thisWeek), t('statThisWeek'), null),
    statCard(
      stats.topStreamer?.name ?? '-',
      t('statTopStreamer'),
      stats.topStreamer ? plural(stats.topStreamer.count, 'statStreamsCount', 'statStreamsCountPlural') : null
    ),
    statCard(
      stats.topGame?.name ?? '-',
      t('statTopGame'),
      stats.topGame ? plural(stats.topGame.count, 'statTimesCount', 'statTimesCountPlural') : null
    )
  )
}

function historyItem(entry: HistoryEntry): HTMLElement {
  const duration = streamDuration(entry)
  const details = [
    entry.game ? h('span', {}, [icon('gamepad'), entry.game]) : null,
    duration ? h('span', {}, [icon('clock'), formatDuration(duration)]) : null
  ].filter((detail) => detail !== null)

  return h('li', { class: 'history-item' }, [
    h('div', { class: 'history-body' }, [
      h('span', { class: 'history-name' }, [entry.displayName]),
      entry.title ? h('span', { class: 'history-title', title: entry.title }, [entry.title]) : null,
      details.length > 0 ? h('span', { class: 'history-details' }, details) : null
    ]),
    h('time', { class: 'history-time', datetime: new Date(entry.timestamp).toISOString() }, [
      formatAgo(entry.timestamp)
    ])
  ])
}

function renderHistory(history: HistoryEntry[]): void {
  clearButton.disabled = history.length === 0
  if (history.length === 0) {
    historyList.replaceChildren(h('li', { class: 'empty' }, [t('emptyHistory')]))
    return
  }
  historyList.replaceChildren(...history.slice(0, HISTORY_SHOWN).map(historyItem))
}

export async function refreshActivity(): Promise<void> {
  try {
    const history = await send('getHistory', { limit: 500 })
    renderStats(history)
    renderHistory(history)
  } catch {
    statsGrid.replaceChildren(h('p', { class: 'empty' }, [t('statsLoadError')]))
    historyList.replaceChildren(h('li', { class: 'empty' }, [t('historyLoadError')]))
  }
}

async function clearHistory(): Promise<void> {
  const confirmed = await confirmDanger(
    t('clearHistoryModalTitle'),
    t('clearHistoryConfirmText'),
    t('clearLabel')
  )
  if (!confirmed) return
  try {
    await send('clearHistory', null)
    await refreshActivity()
  } catch {
    toast(t('historyClearError'), 'error')
  }
}

export async function setupActivity(): Promise<void> {
  clearButton.addEventListener('click', () => void clearHistory())
  await refreshActivity()
}
