import { locale, plural, t } from './i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatViewers(count: number): string {
  if (count < 1000) return String(count)
  const thousands = count / 1000
  return `${thousands >= 100 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}K`
}

export function formatSince(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp
  if (elapsed < HOUR) return t('timeLessThanHour')
  if (elapsed < DAY) return t('timeHours', Math.floor(elapsed / HOUR))
  const days = Math.floor(elapsed / DAY)
  if (days < 7) return t('timeDays', days)
  if (days < 35) return t('timeWeeks', Math.floor(days / 7))
  if (days < 365) return t('timeMonths', Math.floor(days / 30))
  return plural(Math.floor(days / 365), 'timeYear', 'timeYears')
}

export function formatUntil(timestamp: number, now = Date.now()): string | null {
  const remaining = timestamp - now
  if (remaining <= 0) return null
  if (remaining < HOUR) return t('scheduleInMinutes', Math.max(1, Math.floor(remaining / MINUTE)))
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })
  const today = new Date(now)
  const tomorrow = new Date(now + DAY)
  if (date.toDateString() === today.toDateString()) return t('scheduleToday', time)
  if (date.toDateString() === tomorrow.toDateString()) return t('scheduleTomorrow', time)
  const day = date.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${time}`
}

export function formatAgo(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp
  if (elapsed < MINUTE) return t('agoJustNow')
  if (elapsed < HOUR) return t('agoMinutes', Math.floor(elapsed / MINUTE))
  if (elapsed < DAY) return t('agoHours', Math.floor(elapsed / HOUR))
  if (elapsed < 7 * DAY) return t('agoDays', Math.floor(elapsed / DAY))
  return new Date(timestamp).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

export function formatDuration(duration: number): string {
  const hours = Math.floor(duration / HOUR)
  const minutes = Math.floor((duration % HOUR) / MINUTE)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}
