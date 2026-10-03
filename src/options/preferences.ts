import { byId } from '../shared/dom'
import { t } from '../shared/i18n'
import { isTheme, loadSettings, updateSettings, type Settings } from '../shared/settings'
import { toast } from '../shared/ui'

type ToggleKey = Exclude<keyof Settings, 'theme'>

const toggles: [ToggleKey, HTMLInputElement][] = [
  ['notifications', byId('notificationsToggle', HTMLInputElement)],
  ['persistentNotifications', byId('persistentToggle', HTMLInputElement)],
  ['confirmDelete', byId('confirmDeleteToggle', HTMLInputElement)]
]

const themeButtons = [...byId('themeChoice', HTMLDivElement).querySelectorAll('button')]

function render(settings: Settings): void {
  for (const [key, input] of toggles) input.checked = settings[key]
  const persistent = toggles[1]?.[1]
  if (persistent) persistent.disabled = !settings.notifications
  for (const button of themeButtons) {
    button.setAttribute('aria-checked', String(button.dataset.theme === settings.theme))
  }
}

function save(changes: Partial<Settings>): void {
  updateSettings(changes).then(render, () => {
    toast(t('settingsSaveError'), 'error')
  })
}

export async function setupPreferences(): Promise<void> {
  render(await loadSettings())
  for (const [key, input] of toggles) {
    input.addEventListener('change', () => {
      save({ [key]: input.checked })
    })
  }
  for (const button of themeButtons) {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme
      if (isTheme(theme)) save({ theme })
    })
  }
}
