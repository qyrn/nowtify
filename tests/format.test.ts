import { describe, expect, it } from 'vitest'
import { formatViewers } from '../src/shared/format'

describe('formatViewers', () => {
  it('keeps small counts as they are', () => {
    expect(formatViewers(7)).toBe('7')
    expect(formatViewers(999)).toBe('999')
  })

  it('shortens thousands', () => {
    expect(formatViewers(1240)).toBe('1.2K')
    expect(formatViewers(24312)).toBe('24.3K')
    expect(formatViewers(124318)).toBe('124K')
  })

  it('switches to millions instead of showing 1000K and more', () => {
    expect(formatViewers(999_600)).toBe('1M')
    expect(formatViewers(1_204_551)).toBe('1.2M')
  })
})
