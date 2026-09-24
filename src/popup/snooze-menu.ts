import { h } from '../shared/dom'
import { t } from '../shared/i18n'
import { isSnoozed, type Streamer } from '../shared/streamer'

const HOUR = 60 * 60 * 1000

function tomorrowMorning(): number {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date.getTime()
}

export function closeSnoozeMenus(): void {
  document.querySelectorAll('.snooze-menu').forEach((menu) => {
    menu.remove()
  })
}

export function openSnoozeMenu(
  streamer: Streamer,
  card: HTMLElement,
  apply: (until: number | null) => void
): void {
  const alreadyOpen = card.querySelector('.snooze-menu')
  closeSnoozeMenus()
  if (alreadyOpen) return

  const options: [string, () => number | null][] = isSnoozed(streamer)
    ? [[t('snoozeCancel'), () => null]]
    : [
        [t('snooze1h'), () => Date.now() + HOUR],
        [t('snoozeTomorrow'), tomorrowMorning]
      ]

  const buttons = options.map(([label, until]) => {
    const button = h('button', { type: 'button', class: 'snooze-option', role: 'menuitem' }, [label])
    button.addEventListener('click', () => {
      closeSnoozeMenus()
      apply(until())
    })
    return button
  })
  const menu = h('div', { class: 'snooze-menu', role: 'menu' }, buttons)
  card.append(menu)
  if (menu.getBoundingClientRect().bottom > document.documentElement.clientHeight)
    menu.classList.add('upward')
  buttons[0]?.focus()
}
