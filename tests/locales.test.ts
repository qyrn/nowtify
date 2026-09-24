import { describe, expect, it } from 'vitest'
import en from '../public/_locales/en/messages.json'
import fr from '../public/_locales/fr/messages.json'

const sources = import.meta.glob<string>('../src/**/*.{ts,html}', {
  query: '?raw',
  import: 'default',
  eager: true
})

describe('locales', () => {
  it('has the same keys in English and French', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort())
  })

  it('defines every key referenced from the HTML pages', () => {
    const referenced = Object.values(sources).flatMap((source) =>
      [...source.matchAll(/data-i18n(?:-title|-placeholder)?="([^"]+)"/g)].map((match) => match[1] ?? '')
    )
    expect(referenced.length).toBeGreaterThan(0)
    expect(referenced.filter((key) => !(key in en))).toEqual([])
  })

  it('never uses an em dash', () => {
    const messages = [...Object.values(en), ...Object.values(fr)].map((entry) => entry.message)
    expect(messages.filter((message) => message.includes('—'))).toEqual([])
  })
})
