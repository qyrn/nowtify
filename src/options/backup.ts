import { MAX_BACKUP_BYTES } from '../shared/backup'
import { byId } from '../shared/dom'
import { t } from '../shared/i18n'
import { send } from '../shared/messages'
import { toast } from '../shared/ui'

const exportButton = byId('exportBtn', HTMLButtonElement)
const importButton = byId('importBtn', HTMLButtonElement)
const fileInput = byId('importFile', HTMLInputElement)

async function exportData(): Promise<void> {
  try {
    const backup = await send('exportBackup', null)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nowtify-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast(t('exportSuccessToast'), 'success')
  } catch {
    toast(t('exportError'), 'error')
  }
}

async function importData(file: File, onImported: () => Promise<void>): Promise<void> {
  if (file.size > MAX_BACKUP_BYTES) {
    toast(t('fileTooLarge'), 'error')
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    toast(t('invalidFileFormat'), 'error')
    return
  }
  try {
    const result = await send('importBackup', { backup: parsed })
    toast(t('importSuccessToast', result.streamersAdded, result.historyAdded), 'success')
    await onImported()
  } catch {
    toast(t('invalidFileFormat'), 'error')
  }
}

export function setupBackup(onImported: () => Promise<void>): void {
  exportButton.addEventListener('click', () => void exportData())
  importButton.addEventListener('click', () => {
    fileInput.click()
  })
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (file) void importData(file, onImported)
  })
}
