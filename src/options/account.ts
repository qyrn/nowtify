import { avatar, byId } from '../shared/dom'
import { t } from '../shared/i18n'
import { send, type TwitchProfile } from '../shared/messages'
import { toast } from '../shared/ui'

const disconnected = byId('accountDisconnected', HTMLDivElement)
const connected = byId('accountConnected', HTMLDivElement)
const avatarSlot = byId('accountAvatar', HTMLSpanElement)
const nameLabel = byId('accountName', HTMLParagraphElement)
const loginButton = byId('loginBtn', HTMLButtonElement)
const logoutButton = byId('logoutBtn', HTMLButtonElement)

function showDisconnected(): void {
  connected.classList.add('hidden')
  disconnected.classList.remove('hidden')
}

function showConnected(user: TwitchProfile | null): void {
  connected.classList.remove('hidden')
  disconnected.classList.add('hidden')
  const name = user?.displayName ?? 'Twitch'
  avatarSlot.replaceChildren(avatar(user?.avatarUrl ?? null, name, 'account-avatar'))
  nameLabel.textContent = name
}

async function login(): Promise<void> {
  loginButton.disabled = true
  try {
    showConnected(await send('login', null))
    toast(t('twitchConnectedToast'), 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : t('unknownError'), 'error')
  } finally {
    loginButton.disabled = false
  }
}

async function logout(): Promise<void> {
  try {
    await send('logout', null)
    showDisconnected()
    toast(t('twitchDisconnectedToast'), 'success')
  } catch {
    toast(t('disconnectError'), 'error')
  }
}

export async function setupAccount(): Promise<void> {
  loginButton.addEventListener('click', () => void login())
  logoutButton.addEventListener('click', () => void logout())
  const state = await send('getAuthState', null)
  if (state.status === 'connected') showConnected(state.user)
  else showDisconnected()
}
