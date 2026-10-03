import { describe, expect, it } from 'vitest'
import { forEachConcurrently } from '../src/background/concurrency'

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1))

describe('forEachConcurrently', () => {
  it('runs every item without exceeding the limit', async () => {
    let running = 0
    let peak = 0
    const seen: number[] = []
    await forEachConcurrently([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      running++
      peak = Math.max(peak, running)
      await tick()
      seen.push(item)
      running--
    })
    expect(peak).toBe(3)
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('rejects when a task fails', async () => {
    await expect(
      forEachConcurrently([1, 2], 2, async (item) => {
        await tick()
        if (item === 2) throw new Error('boom')
      })
    ).rejects.toThrow('boom')
  })

  it('does nothing for an empty list', async () => {
    let calls = 0
    await forEachConcurrently([], 4, async () => {
      calls++
      await tick()
    })
    expect(calls).toBe(0)
  })
})
