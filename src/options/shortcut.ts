import { browser } from 'wxt/browser'
import { byId } from '../shared/dom'
import { t } from '../shared/i18n'

const description = byId('shortcutDesc', HTMLSpanElement)
const changeButton = byId('shortcutChangeBtn', HTMLButtonElement)

export async function setupShortcut(): Promise<void> {
  changeButton.addEventListener('click', () => {
    void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })
  })
  const commands = await browser.commands.getAll()
  const shortcut = commands.find((command) => command.name === '_execute_action')?.shortcut
  description.textContent = shortcut ? t('shortcutDesc', shortcut) : t('shortcutNone')
}
