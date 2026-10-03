import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/shared/settings'

describe('normalizeSettings', () => {
  it('keeps a known theme', () => {
    expect(normalizeSettings({ theme: 'light' }).theme).toBe('light')
  })

  it('falls back to the automatic theme for an unknown value', () => {
    expect(normalizeSettings({ theme: 'sepia' }).theme).toBe('auto')
  })

  it('returns the defaults for settings saved before themes existed', () => {
    expect(normalizeSettings({ notifications: true })).toEqual(DEFAULT_SETTINGS)
  })
})
