import type { ChannelSuggestion } from '../shared/messages'
import { isValidLogin } from '../shared/streamer'

const TO_LETTER: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' }
const TO_DIGIT: Record<string, string> = { o: '0', i: '1', l: '1', e: '3', a: '4', s: '5', t: '7' }
const MAX_VARIANTS = 20

function loose(text: string): string {
  return text.toLowerCase().replace(/[013457]/g, (digit) => TO_LETTER[digit] ?? digit)
}

export function lookalikeLogins(query: string): string[] {
  const login = query.trim().toLowerCase()
  if (!isValidLogin(login)) return []
  const variants = new Set([login])
  for (let index = 0; index < login.length; index++) {
    const char = login.charAt(index)
    const swap = TO_DIGIT[char] ?? TO_LETTER[char]
    if (swap) variants.add(login.slice(0, index) + swap + login.slice(index + 1))
  }
  variants.add(login.replace(/[oilesta]/g, (char) => TO_DIGIT[char] ?? char))
  variants.add(loose(login))
  return [...variants].slice(0, MAX_VARIANTS)
}

export function isLookalike(login: string, query: string): boolean {
  return loose(login) === loose(query.trim())
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
  limit: number,
  followers: ReadonlyMap<string, number>
): ChannelSuggestion[] {
  const needle = loose(query.trim())
  return channels
    .map((channel, order) => ({
      channel,
      order,
      score: relevance(channel, needle),
      followers: followers.get(channel.login) ?? -1
    }))
    .sort((a, b) => b.score - a.score || b.followers - a.followers || a.order - b.order)
    .slice(0, limit)
    .map(({ channel }) => channel)
}
