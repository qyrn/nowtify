import '../../styles/base.css'
import '../../styles/options.css'
import { browser } from 'wxt/browser'
import { setupAccount } from '../../options/account'
import { refreshActivity, setupActivity } from '../../options/activity'
import { setupBackup } from '../../options/backup'
import { setupPreferences } from '../../options/preferences'
import { setupShortcut } from '../../options/shortcut'
import { refreshTeams } from '../../options/teams'
import { byId } from '../../shared/dom'
import { t, translatePage } from '../../shared/i18n'
import { followThemeSetting } from '../../shared/theme'

async function start(): Promise<void> {
  translatePage()
  void followThemeSetting()
  document.title = t('optionsTitle')
  byId('version', HTMLSpanElement).textContent = `Nowtify ${browser.runtime.getManifest().version}`
  setupBackup(async () => {
    await Promise.all([refreshTeams(), refreshActivity()])
  })
  browser.storage.local.onChanged.addListener((changes) => {
    if ('lastCheckAt' in changes) void Promise.all([refreshTeams(), refreshActivity()])
  })
  await Promise.all([setupAccount(), setupPreferences(), setupShortcut(), setupActivity(), refreshTeams()])
}

void start()
