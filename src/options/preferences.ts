import { byId } from '../shared/dom'
import { t } from '../shared/i18n'
import { loadSettings, updateSettings, type Settings } from '../shared/settings'
import { toast } from '../shared/ui'

type ToggleKey = Exclude<keyof Settings, 'compactMode'>

const toggles: [ToggleKey, HTMLInputElement][] = [
  ['notifications', byId('notificationsToggle', HTMLInputElement)],
  ['persistentNotifications', byId('persistentToggle', HTMLInputElement)],
  ['confirmDelete', byId('confirmDeleteToggle', HTMLInputElement)]
]

function render(settings: Settings): void {
  for (const [key, input] of toggles) input.checked = settings[key]
  const persistent = toggles[1]?.[1]
  if (persistent) persistent.disabled = !settings.notifications
}

export async function setupPreferences(): Promise<void> {
  render(await loadSettings())
  for (const [key, input] of toggles) {
    input.addEventListener('change', () => {
      updateSettings({ [key]: input.checked }).then(render, () => {
        toast(t('settingsSaveError'), 'error')
      })
    })
  }
}
