import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { ensureCheckAlarm, scheduleChecks } from '../src/background/checker'
import { CHECK_ALARM, CHECK_PERIOD_MINUTES, CHECK_PERIOD_MINUTES_WHILE_LIVE } from '../src/background/config'

async function alarmPeriod(): Promise<number | undefined> {
  return (await fakeBrowser.alarms.get(CHECK_ALARM))?.periodInMinutes
}

describe('ensureCheckAlarm', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('creates the alarm when it is missing', async () => {
    await ensureCheckAlarm()
    expect(await alarmPeriod()).toBe(CHECK_PERIOD_MINUTES)
  })

  it('keeps the faster period set while someone is live', async () => {
    await scheduleChecks(1)
    await ensureCheckAlarm()
    expect(await alarmPeriod()).toBe(CHECK_PERIOD_MINUTES_WHILE_LIVE)
  })
})
