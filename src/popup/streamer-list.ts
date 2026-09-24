import type { Streamer } from '../shared/streamer'
import { renderCard, type CardActions } from './streamer-card'

interface RenderedCard {
  signature: string
  element: HTMLElement
}

export class StreamerList {
  private readonly cards = new Map<string, RenderedCard>()
  private firstRender = true

  constructor(
    private readonly container: HTMLElement,
    private readonly actions: CardActions
  ) {}

  render(streamers: Streamer[]): void {
    const visibleIds = new Set(streamers.map((streamer) => streamer.id))
    for (const [id, card] of this.cards) {
      if (visibleIds.has(id)) continue
      card.element.remove()
      this.cards.delete(id)
    }

    streamers.forEach((streamer, index) => {
      const element = this.cardFor(streamer)
      const current = this.container.children[index]
      if (current !== element) this.container.insertBefore(element, current ?? null)
    })
    this.firstRender = false
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
