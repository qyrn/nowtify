import type { ChannelSuggestion } from '../shared/messages'

const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' }

function loose(text: string): string {
  return text.toLowerCase().replace(/[013457]/g, (digit) => LOOKALIKES[digit] ?? digit)
}

function relevance(channel: ChannelSuggestion, query: string): number {
  const names = [loose(channel.login), loose(channel.displayName)]
  if (names.some((name) => name === query)) return 3
  if (names.some((name) => name.startsWith(query))) return 2
  return names.some((name) => name.includes(query)) ? 1 : 0
}

export function rankChannels(
  channels: ChannelSuggestion[],
  query: string,
  limit: number
): ChannelSuggestion[] {
  const needle = loose(query.trim())
  return channels
    .map((channel, order) => ({ channel, order, score: relevance(channel, needle) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ channel }) => channel)
}
