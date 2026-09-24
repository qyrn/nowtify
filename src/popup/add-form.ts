import { avatar, byId, h } from '../shared/dom'
import { plural, t } from '../shared/i18n'
import { icon } from '../shared/icons'
import { send, type ChannelSuggestion, type TeamSuggestion } from '../shared/messages'
import { parseAddInput } from '../shared/streamer'
import { toast } from '../shared/ui'

const SEARCH_DELAY = 250

export class AddForm {
  private readonly form = byId('addForm', HTMLFormElement)
  private readonly input = byId('addInput', HTMLInputElement)
  private readonly button = byId('addBtn', HTMLButtonElement)
  private readonly suggestions = byId('suggestions', HTMLDivElement)
  private searchTimer: ReturnType<typeof setTimeout> | undefined
  private searchId = 0

  constructor(private readonly onAdded: () => Promise<void>) {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault()
      void this.submit(this.input.value)
    })
    this.input.addEventListener('input', () => {
      this.scheduleSearch()
    })
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.hideSuggestions()
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        this.suggestions.querySelector('button')?.focus()
      }
    })
    this.suggestions.addEventListener('keydown', (event) => {
      this.moveFocus(event)
    })
    document.addEventListener('click', (event) => {
      if (event.target instanceof Node && !this.form.contains(event.target)) this.hideSuggestions()
    })
  }

  focus(): void {
    this.input.focus()
  }

  private moveFocus(event: KeyboardEvent): void {
    const items = [...this.suggestions.querySelectorAll('button')]
    const index = items.findIndex((item) => item === document.activeElement)
    if (event.key === 'ArrowDown') items[index + 1]?.focus()
    if (event.key === 'ArrowUp') (index > 0 ? items[index - 1] : this.input)?.focus()
    if (event.key === 'Escape') {
      this.hideSuggestions()
      this.input.focus()
    }
    if (event.key.startsWith('Arrow')) event.preventDefault()
  }

  private scheduleSearch(): void {
    clearTimeout(this.searchTimer)
    this.hideSuggestions()
    const value = this.input.value.trim()
    if (value.length < 2) return
    this.searchTimer = setTimeout(() => {
      void this.search(value)
    }, SEARCH_DELAY)
  }

  private async search(value: string): Promise<void> {
    const searchId = ++this.searchId
    const parsed = parseAddInput(value)
    try {
      if (parsed?.kind === 'team') {
        const team = await send('findTeam', { name: parsed.name })
        if (searchId === this.searchId) this.showSuggestions(team ? [this.teamItem(team)] : [])
        return
      }
      const channels = await send('searchChannels', { query: value })
      if (searchId === this.searchId)
        this.showSuggestions(channels.map((channel) => this.channelItem(channel)))
    } catch {
      if (searchId === this.searchId) this.hideSuggestions()
    }
  }

  private channelItem(channel: ChannelSuggestion): HTMLButtonElement {
    const item = h('button', { type: 'button', class: 'suggestion', role: 'option' }, [
      avatar(channel.avatarUrl, channel.displayName, 'suggestion-avatar'),
      h('span', { class: 'suggestion-name' }, [channel.displayName]),
      channel.isLive ? h('span', { class: 'suggestion-badge live' }, [t('liveBadge')]) : null
    ])
    item.addEventListener('click', () => {
      void this.submit(channel.login)
    })
    return item
  }

  private teamItem(team: TeamSuggestion): HTMLButtonElement {
    const item = h('button', { type: 'button', class: 'suggestion', role: 'option' }, [
      team.logoUrl
        ? avatar(team.logoUrl, team.displayName, 'suggestion-avatar')
        : h('span', { class: 'suggestion-avatar avatar-fallback' }, [icon('users')]),
      h('span', { class: 'suggestion-name' }, [team.displayName]),
      h('span', { class: 'suggestion-badge' }, [
        plural(team.memberCount, 'teamMembersCount', 'teamMembersCountPlural')
      ])
    ])
    item.addEventListener('click', () => {
      void this.submit(`team/${team.name}`)
    })
    return item
  }

  private showSuggestions(items: HTMLButtonElement[]): void {
    this.suggestions.replaceChildren(...items)
    this.suggestions.classList.toggle('hidden', items.length === 0)
    this.input.setAttribute('aria-expanded', String(items.length > 0))
  }

  private hideSuggestions(): void {
    this.searchId++
    this.showSuggestions([])
  }

  private setBusy(busy: boolean): void {
    this.button.disabled = busy
    this.input.disabled = busy
    this.button.classList.toggle('busy', busy)
  }

  private async submit(value: string): Promise<void> {
    clearTimeout(this.searchTimer)
    this.hideSuggestions()
    if (!value.trim()) {
      toast(t('enterUrlOrName'), 'error')
      return
    }
    const parsed = parseAddInput(value)
    if (!parsed) {
      toast(t('unrecognizedFormat'), 'error')
      return
    }

    this.setBusy(true)
    try {
      const message =
        parsed.kind === 'team' ? await this.addTeam(parsed.name) : await this.addStreamer(parsed.login)
      if (message.tone === 'success') {
        this.input.value = ''
        await this.onAdded()
      }
      toast(message.text, message.tone)
    } catch {
      toast(t('addErrorGeneric'), 'error')
    } finally {
      this.setBusy(false)
      this.input.focus()
    }
  }

  private async addStreamer(login: string): Promise<{ text: string; tone: 'success' | 'error' }> {
    const result = await send('addStreamer', { login })
    switch (result.status) {
      case 'added':
        return { text: t('streamerAddedToast', result.streamer.displayName), tone: 'success' }
      case 'duplicate':
        return { text: t('streamerAlreadyInList'), tone: 'error' }
      case 'notFound':
        return { text: t('streamerNotFound'), tone: 'error' }
      case 'disconnected':
        return { text: t('twitchConnectRequiredText'), tone: 'error' }
    }
  }

  private async addTeam(name: string): Promise<{ text: string; tone: 'success' | 'error' }> {
    const result = await send('addTeam', { name })
    switch (result.status) {
      case 'added':
        return { text: t('teamAddedToast', result.displayName, result.added), tone: 'success' }
      case 'empty':
        return { text: t('noMembersInTeamError'), tone: 'error' }
      case 'notFound':
        return { text: t('teamNotFoundError'), tone: 'error' }
      case 'disconnected':
        return { text: t('twitchConnectRequiredText'), tone: 'error' }
    }
  }
}
