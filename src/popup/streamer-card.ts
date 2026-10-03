import { avatar, h, monogram } from '../shared/dom'
import { formatDuration, formatExactCount, formatSince, formatUntil, formatViewers } from '../shared/format'
import { t } from '../shared/i18n'
import { icon } from '../shared/icons'
import { isRecentlyLive, notificationsPaused, teamLabel, type Streamer } from '../shared/streamer'

export interface CardActions {
  open: (streamer: Streamer) => void
  snooze: (streamer: Streamer, anchor: HTMLElement) => void
  remove: (streamer: Streamer) => void
}

function teamBadge(streamer: Streamer): HTMLElement | null {
  const label = teamLabel(streamer)
  if (!label) return null
  const badge = h('span', { class: 'card-team', title: label }, [monogram(label)])
  if (streamer.teamLogoUrl) {
    const logo = h('img', { src: streamer.teamLogoUrl, alt: '', referrerpolicy: 'no-referrer' })
    logo.addEventListener('error', () => {
      logo.remove()
      badge.textContent = monogram(label)
    })
    badge.replaceChildren(logo)
  }
  return badge
}

function subLine(streamer: Streamer): HTMLElement | null {
  if (streamer.isLive) {
    const parts = [
      streamer.game ? h('span', { class: 'card-game' }, [streamer.game]) : null,
      streamer.title ? h('span', { class: 'card-title' }, [streamer.title]) : null
    ]
    if (parts.every((part) => part === null)) return null
    return h('div', { class: 'card-sub', title: streamer.title ?? '' }, parts)
  }
  if (streamer.nextStreamAt === null) return null
  const when = formatUntil(streamer.nextStreamAt)
  if (!when) return null
  return h('div', { class: 'card-sub card-next' }, [icon('calendar'), t('nextStreamLabel', when)])
}

function sideLabel(streamer: Streamer): string {
  if (streamer.isLive) return streamer.viewerCount ? formatViewers(streamer.viewerCount) : t('liveBadge')
  return streamer.lastLiveAt ? formatSince(streamer.lastLiveAt) : t('statusOffline')
}

function preview(streamer: Streamer): HTMLElement | null {
  if (!streamer.isLive || !streamer.thumbnailUrl) return null
  const thumbnail = h('img', {
    class: 'preview-thumbnail',
    src: `${streamer.thumbnailUrl}?t=${Math.floor(Date.now() / 60_000)}`,
    alt: '',
    referrerpolicy: 'no-referrer'
  })
  thumbnail.addEventListener('error', () => {
    thumbnail.remove()
  })
  const elapsed = streamer.startedAt === null ? null : Date.now() - streamer.startedAt
  return h('div', { class: 'preview' }, [
    thumbnail,
    h('div', { class: 'preview-meta' }, [
      h('span', {}, [
        elapsed !== null && elapsed > 0 ? t('liveSince', formatDuration(elapsed)) : t('streamInProgress')
      ]),
      streamer.viewerCount
        ? h('span', { class: 'preview-viewers' }, [t('viewersCount', formatExactCount(streamer.viewerCount))])
        : null
    ])
  ])
}

function actionButton(
  className: string,
  label: string,
  iconName: 'bellOff' | 'close' | 'chevronDown'
): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: `card-action ${className}`, title: label, 'aria-label': label },
    [icon(iconName)]
  )
}

export function renderCard(streamer: Streamer, actions: CardActions): HTMLElement {
  const paused = notificationsPaused(streamer)
  const pausedLabel = streamer.muted ? t('notifMuted') : t('notifPaused')
  const previewBlock = preview(streamer)
  const toggle = previewBlock ? actionButton('preview-toggle', t('previewTitle'), 'chevronDown') : null
  toggle?.setAttribute('aria-expanded', 'false')
  const snoozeButton = actionButton(
    paused ? 'card-snooze active' : 'card-snooze',
    paused ? pausedLabel : t('notifPauseAction'),
    'bellOff'
  )
  const removeButton = actionButton('card-remove', t('deleteTitle'), 'close')

  const classes = ['card']
  if (streamer.isLive) classes.push('live')
  if (isRecentlyLive(streamer)) classes.push('recent')

  const card = h('article', { class: classes.join(' '), 'data-id': streamer.id }, [
    avatar(streamer.avatarUrl, streamer.displayName, 'card-avatar'),
    h('div', { class: 'card-body' }, [
      h('div', { class: 'card-top' }, [
        h(
          'a',
          {
            class: 'card-name',
            href: `https://www.twitch.tv/${streamer.login}`,
            title: streamer.displayName
          },
          [streamer.displayName]
        ),
        paused ? h('span', { class: 'card-snoozed', title: pausedLabel }, [icon('bellOff')]) : null,
        teamBadge(streamer)
      ]),
      subLine(streamer)
    ]),
    h('span', { class: 'card-side' }, [sideLabel(streamer)]),
    h('div', { class: 'card-actions' }, [toggle, snoozeButton, removeButton]),
    previewBlock
  ])

  card.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.card-actions, .snooze-menu')) return
    event.preventDefault()
    actions.open(streamer)
  })
  toggle?.addEventListener('click', () => {
    const open = card.classList.toggle('preview-open')
    toggle.setAttribute('aria-expanded', String(open))
  })
  snoozeButton.addEventListener('click', () => {
    actions.snooze(streamer, card)
  })
  removeButton.addEventListener('click', () => {
    actions.remove(streamer)
  })
  return card
}
