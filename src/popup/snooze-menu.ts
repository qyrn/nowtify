import { h } from '../shared/dom'
import { t } from '../shared/i18n'
import { SNOOZE_HOUR, tomorrowMorning } from '../shared/snooze'
import { notificationsPaused, type Streamer } from '../shared/streamer'

export interface PauseChoice {
  snoozedUntil: number | null
  muted: boolean
}

export function closeSnoozeMenus(): void {
  document.querySelectorAll('.snooze-menu').forEach((menu) => {
    menu.remove()
  })
}

export function openSnoozeMenu(
  streamer: Streamer,
  card: HTMLElement,
  apply: (choice: PauseChoice) => void
): void {
  const alreadyOpen = card.querySelector('.snooze-menu')
  closeSnoozeMenus()
  if (alreadyOpen) return

  const options: [string, () => PauseChoice][] = notificationsPaused(streamer)
    ? [[t('snoozeCancel'), () => ({ snoozedUntil: null, muted: false })]]
    : [
        [t('snooze1h'), () => ({ snoozedUntil: Date.now() + SNOOZE_HOUR, muted: false })],
        [t('snoozeTomorrow'), () => ({ snoozedUntil: tomorrowMorning(), muted: false })],
        [t('muteForever'), () => ({ snoozedUntil: null, muted: true })]
      ]

  const buttons = options.map(([label, choose]) => {
    const button = h('button', { type: 'button', class: 'snooze-option', role: 'menuitem' }, [label])
    button.addEventListener('click', () => {
      closeSnoozeMenus()
      apply(choose())
    })
    return button
  })
  const menu = h('div', { class: 'snooze-menu', role: 'menu' }, buttons)
  card.append(menu)
  if (menu.getBoundingClientRect().bottom > document.documentElement.clientHeight)
    menu.classList.add('upward')
  buttons[0]?.focus()
}
