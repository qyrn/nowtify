import { avatar, h } from '../shared/dom'
import { formatSince, formatUntil, formatViewers } from '../shared/format'
import { t } from '../shared/i18n'
import { icon } from '../shared/icons'
import { isRecentlyLive, isSnoozed, teamLabel, type Streamer } from '../shared/streamer'

export interface CardActions {
  open: (streamer: Streamer) => void
  snooze: (streamer: Streamer, anchor: HTMLElement) => void
  remove: (streamer: Streamer) => void
}

function statusBadge(streamer: Streamer): HTMLElement {
  if (streamer.isLive) {
    const label = streamer.viewerCount ? formatViewers(streamer.viewerCount) : t('liveBadge')
    return h('span', { class: 'status status-live' }, [h('span', { class: 'status-dot' }), label])
  }
  const label = streamer.lastLiveAt ? formatSince(streamer.lastLiveAt) : t('statusOffline')
  return h('span', { class: 'status' }, [label])
}

function teamBadge(streamer: Streamer): HTMLElement | null {
  const label = teamLabel(streamer)
  if (!label) return null
  const logo = streamer.teamLogoUrl
    ? h('img', { class: 'team-logo', src: streamer.teamLogoUrl, alt: '', referrerpolicy: 'no-referrer' })
    : null
  logo?.addEventListener('error', () => {
    logo.remove()
  })
  return h('span', { class: 'team', title: label }, [logo, h('span', { class: 'team-name' }, [label])])
}

function scheduleLine(streamer: Streamer): HTMLElement | null {
  if (streamer.isLive || streamer.nextStreamAt === null) return null
  const when = formatUntil(streamer.nextStreamAt)
  if (!when) return null
  return h('div', { class: 'schedule' }, [icon('calendar'), t('nextStreamLabel', when)])
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
  return h('div', { class: 'preview' }, [
    thumbnail,
    h('div', { class: 'preview-meta' }, [
      h('span', { class: 'preview-game' }, [icon('gamepad'), streamer.game ?? t('streamInProgress')]),
      streamer.viewerCount
        ? h('span', { class: 'preview-viewers' }, [
            icon('eye'),
            t('viewersCount', formatViewers(streamer.viewerCount))
          ])
        : null
    ])
  ])
}

function actionButton(className: string, label: string, iconName: 'bellOff' | 'close'): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: `card-action ${className}`, title: label, 'aria-label': label },
    [icon(iconName)]
  )
}

export function renderCard(streamer: Streamer, actions: CardActions): HTMLElement {
  const snoozed = isSnoozed(streamer)
  const previewBlock = preview(streamer)
  const toggle = previewBlock
    ? h(
        'button',
        { type: 'button', class: 'preview-toggle', 'aria-expanded': 'false', title: t('previewTitle') },
        [icon('chevronDown')]
      )
    : null
  const snoozeButton = actionButton(
    snoozed ? 'snooze active' : 'snooze',
    snoozed ? t('notifPaused') : t('notifPauseAction'),
    'bellOff'
  )
  const removeButton = actionButton('remove', t('deleteTitle'), 'close')

  const classes = ['card']
  if (streamer.isLive) classes.push('live')
  if (isRecentlyLive(streamer)) classes.push('recent')
  if (snoozed) classes.push('snoozed')

  const card = h('article', { class: classes.join(' '), 'data-id': streamer.id }, [
    h('div', { class: 'card-main' }, [
      avatar(streamer.avatarUrl, streamer.displayName, 'card-avatar'),
      h('div', { class: 'card-body' }, [
        h('div', { class: 'card-line' }, [
          h(
            'a',
            {
              class: 'card-name',
              href: `https://www.twitch.tv/${streamer.login}`,
              title: streamer.displayName
            },
            [streamer.displayName]
          ),
          snoozed
            ? h('span', { class: 'snoozed-indicator', title: t('notifPaused') }, [icon('bellOff')])
            : null,
          statusBadge(streamer),
          toggle
        ]),
        h('div', { class: 'card-line card-sub' }, [
          h('span', { class: 'card-title', title: streamer.title ?? '' }, [streamer.title ?? '']),
          teamBadge(streamer)
        ]),
        scheduleLine(streamer)
      ])
    ]),
    h('div', { class: 'card-actions' }, [snoozeButton, removeButton]),
    previewBlock
  ])

  card.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.card-actions, .preview-toggle, .snooze-menu')) return
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
