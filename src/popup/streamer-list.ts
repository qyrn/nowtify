import { h } from '../shared/dom'
import { t } from '../shared/i18n'
import type { Streamer } from '../shared/streamer'
import { renderCard, type CardActions } from './streamer-card'

interface RenderedCard {
  signature: string
  element: HTMLElement
}

interface Group {
  section: HTMLElement
  list: HTMLElement
}

function createGroup(label: string): Group {
  const list = h('div', { class: 'group-list' })
  return {
    section: h('section', { class: 'group hidden' }, [h('p', { class: 'group-label' }, [label]), list]),
    list
  }
}

export class StreamerList {
  private readonly cards = new Map<string, RenderedCard>()
  private readonly live = createGroup(t('groupLive'))
  private readonly offline = createGroup(t('groupOffline'))
  private firstRender = true

  constructor(
    container: HTMLElement,
    private readonly actions: CardActions
  ) {
    container.replaceChildren(this.live.section, this.offline.section)
  }

  render(streamers: Streamer[]): void {
    const visibleIds = new Set(streamers.map((streamer) => streamer.id))
    for (const [id, card] of this.cards) {
      if (visibleIds.has(id)) continue
      card.element.remove()
      this.cards.delete(id)
    }

    this.fill(
      this.live,
      streamers.filter((streamer) => streamer.isLive)
    )
    this.fill(
      this.offline,
      streamers.filter((streamer) => !streamer.isLive)
    )
    this.firstRender = false
  }

  private fill(group: Group, streamers: Streamer[]): void {
    group.section.classList.toggle('hidden', streamers.length === 0)
    streamers.forEach((streamer, index) => {
      const element = this.cardFor(streamer)
      const current = group.list.children[index]
      if (current !== element) group.list.insertBefore(element, current ?? null)
    })
  }

  private cardFor(streamer: Streamer): HTMLElement {
    const signature = `${Math.floor(Date.now() / 60_000)}:${JSON.stringify(streamer)}`
    const existing = this.cards.get(streamer.id)
    if (existing?.signature === signature) return existing.element

    const element = renderCard(streamer, this.actions)
    if (existing) {
      if (existing.element.classList.contains('preview-open') && element.querySelector('.preview')) {
        element.classList.add('preview-open')
        element.querySelector('.preview-toggle')?.setAttribute('aria-expanded', 'true')
      }
      if (streamer.isLive && !existing.element.classList.contains('live')) element.classList.add('went-live')
      existing.element.replaceWith(element)
    } else if (!this.firstRender) {
      element.classList.add('entering')
    }
    this.cards.set(streamer.id, { signature, element })
    return element
  }
}
