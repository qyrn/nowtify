import { byId, h } from '../shared/dom'
import { t } from '../shared/i18n'
import { teamLabel, type Streamer } from '../shared/streamer'

export class TeamFilter {
  private readonly wrapper = byId('teamFilter', HTMLDivElement)
  private readonly button = byId('teamFilterBtn', HTMLButtonElement)
  private readonly label = byId('teamFilterLabel', HTMLSpanElement)
  private readonly menu = byId('teamFilterMenu', HTMLDivElement)
  private selected: string | null = null

  constructor(private readonly onChange: () => void) {
    this.button.addEventListener('click', (event) => {
      event.stopPropagation()
      this.setOpen(this.menu.classList.contains('hidden'))
    })
    document.addEventListener('click', () => {
      this.setOpen(false)
    })
  }

  apply(streamers: Streamer[]): Streamer[] {
    return this.selected ? streamers.filter((streamer) => streamer.team === this.selected) : streamers
  }

  update(streamers: Streamer[]): void {
    const teams = new Map<string, string>()
    for (const streamer of streamers) {
      const label = teamLabel(streamer)
      if (streamer.team && label) teams.set(streamer.team, label)
    }
    if (this.selected && !teams.has(this.selected)) this.selected = null

    const options: [string | null, string][] = [
      [null, t('allTeams')],
      ...[...teams].sort((a, b) => a[1].localeCompare(b[1]))
    ]
    this.menu.replaceChildren(
      ...options.map(([team, label]) => {
        const option = h(
          'button',
          {
            type: 'button',
            class: 'team-option',
            role: 'option',
            'aria-selected': String(team === this.selected)
          },
          [label]
        )
        option.addEventListener('click', () => {
          this.selected = team
          this.setOpen(false)
          this.onChange()
        })
        return option
      })
    )
    this.label.textContent = this.selected ? (teams.get(this.selected) ?? '') : t('allTeams')
    this.button.classList.toggle('active', this.selected !== null)
    this.wrapper.classList.toggle('hidden', teams.size === 0)
  }

  private setOpen(open: boolean): void {
    this.menu.classList.toggle('hidden', !open)
    this.button.setAttribute('aria-expanded', String(open))
  }
}
