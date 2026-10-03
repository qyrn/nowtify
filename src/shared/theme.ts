import { browser } from 'wxt/browser'
import { isTheme, loadSettings, normalizeSettings, type Theme } from './settings'

const CACHE_KEY = 'theme'

function cachedTheme(): Theme {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return isTheme(cached) ? cached : 'auto'
  } catch {
    return 'auto'
  }
}

function applyTheme(theme: Theme): void {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(CACHE_KEY, theme)
  } catch {
    return
  }
}

export async function followThemeSetting(): Promise<void> {
  applyTheme(cachedTheme())
  applyTheme((await loadSettings()).theme)
  browser.storage.sync.onChanged.addListener((changes) => {
    if (changes.settings) applyTheme(normalizeSettings(changes.settings.newValue).theme)
  })
}
