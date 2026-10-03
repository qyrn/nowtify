export const SNOOZE_HOUR = 60 * 60 * 1000

export function tomorrowMorning(now = new Date()): number {
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date.getTime()
}
