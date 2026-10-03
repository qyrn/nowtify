import { byId } from '../shared/dom'
import { plural, t } from '../shared/i18n'
import { matchesQuery, type Streamer } from '../shared/streamer'

export class ListFilter {
  private readonly input = byId('listFilter', HTMLInputElement)
  private readonly noMatch = byId('noMatch', HTMLParagraphElement)

  constructor(
    private readonly onChange: () => void,
    private readonly onSubmit: () => void
  ) {
    this.input.addEventListener('input', () => {
      this.onChange()
    })
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.onSubmit()
      if (event.key === 'Escape' && this.input.value) {
        event.preventDefault()
        this.input.value = ''
        this.onChange()
      }
    })
  }

  apply(streamers: Streamer[]): Streamer[] {
    return streamers.filter((streamer) => matchesQuery(streamer, this.input.value))
  }

  update(total: number, visible: number): void {
    this.input.placeholder = plural(total, 'filterPlaceholder', 'filterPlaceholderPlural')
    const query = this.input.value.trim()
    this.noMatch.classList.toggle('hidden', total === 0 || visible > 0)
    this.noMatch.textContent = query ? t('noMatchText', query) : ''
  }

  focus(): void {
    this.input.focus()
  }
}
