import { avatar, h, monogram } from '../shared/dom'
import { formatAgo, formatDuration, formatExactCount, formatUntil, formatViewers } from '../shared/format'
import { t } from '../shared/i18n'
import { icon } from '../shared/icons'
import { isRecentlyLive, notificationsPaused, teamLabel, vodUrl, type Streamer } from '../shared/streamer'

export interface CardActions {
  open: (url: string) => void
  snooze: (streamer: Streamer, anchor: HTMLElement) => void
  remove: (streamer: Streamer) => void
}

export function channelUrl(streamer: Streamer): string {
  return `https://www.twitch.tv/${streamer.login}`
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

function streamLine(streamer: Streamer): HTMLElement | null {
  const parts = [
    streamer.game ? h('span', { class: 'card-game' }, [streamer.game]) : null,
    streamer.title ? h('span', { class: 'card-title' }, [streamer.title]) : null
  ]
  if (parts.every((part) => part === null)) return null
  return h('div', { class: 'card-sub', title: streamer.title ?? '' }, parts)
}

function nextStreamLine(streamer: Streamer): HTMLElement | null {
  if (streamer.nextStreamAt === null) return null
  const when = formatUntil(streamer.nextStreamAt)
  if (!when) return null
  return h('div', { class: 'card-sub card-next' }, [icon('calendar'), t('nextStreamLabel', when)])
}

function sideLabel(streamer: Streamer): string {
  if (streamer.isLive) return streamer.viewerCount ? formatViewers(streamer.viewerCount) : t('liveBadge')
  return streamer.lastLiveAt ? formatAgo(streamer.lastLiveAt) : t('statusOffline')
}

function thumbnailImage(url: string): HTMLImageElement {
  const thumbnail = h('img', { class: 'preview-thumbnail', src: url, alt: '', referrerpolicy: 'no-referrer' })
  thumbnail.addEventListener('error', () => {
    thumbnail.remove()
  })
  return thumbnail
}

function previewBlock(
  className: string,
  thumbnailUrl: string | null,
  left: string,
  right: string | null
): HTMLElement {
  return h('div', { class: `preview ${className}` }, [
    thumbnailUrl ? thumbnailImage(thumbnailUrl) : null,
    h('div', { class: 'preview-meta' }, [
      h('span', {}, [left]),
      right ? h('span', { class: 'preview-count' }, [right]) : null
    ])
  ])
}

function livePreview(streamer: Streamer): HTMLElement | null {
  if (!streamer.thumbnailUrl) return null
  const elapsed = streamer.startedAt === null ? null : Date.now() - streamer.startedAt
  return previewBlock(
    'preview-live',
    `${streamer.thumbnailUrl}?t=${Math.floor(Date.now() / 60_000)}`,
    elapsed !== null && elapsed > 0 ? t('liveSince', formatDuration(elapsed)) : t('streamInProgress'),
    streamer.viewerCount ? t('viewersCount', formatExactCount(streamer.viewerCount)) : null
  )
}

function vodPreview(streamer: Streamer): HTMLElement | null {
  const vod = streamer.lastVod
  if (!vod) return null
  return previewBlock(
    'preview-vod',
    vod.thumbnailUrl,
    t('vodSummary', formatDuration(vod.duration)),
    vod.viewCount === null ? null : t('vodViews', formatExactCount(vod.viewCount))
  )
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
  const preview = streamer.isLive ? livePreview(streamer) : vodPreview(streamer)
  const toggle = preview
    ? actionButton(
        'preview-toggle',
        streamer.isLive ? t('previewTitle') : t('vodPreviewTitle'),
        'chevronDown'
      )
    : null
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
        h('a', { class: 'card-name', href: channelUrl(streamer), title: streamer.displayName }, [
          streamer.displayName
        ]),
        paused ? h('span', { class: 'card-snoozed', title: pausedLabel }, [icon('bellOff')]) : null,
        teamBadge(streamer)
      ]),
      streamLine(streamer),
      streamer.isLive ? null : nextStreamLine(streamer)
    ]),
    h('span', { class: 'card-side' }, [sideLabel(streamer)]),
    h('div', { class: 'card-actions' }, [toggle, snoozeButton, removeButton]),
    preview
  ])

  card.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.card-actions, .snooze-menu')) return
    event.preventDefault()
    const vod = streamer.lastVod
    actions.open(vod && target?.closest('.preview-vod') ? vodUrl(vod) : channelUrl(streamer))
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
