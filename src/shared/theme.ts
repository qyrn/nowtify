import { browser } from 'wxt/browser'
import { loadSettings, normalizeSettings, type Theme } from './settings'

export function applyTheme(theme: Theme): void {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export async function followThemeSetting(): Promise<void> {
  applyTheme((await loadSettings()).theme)
  browser.storage.sync.onChanged.addListener((changes) => {
    if (changes.settings) applyTheme(normalizeSettings(changes.settings.newValue).theme)
  })
}
