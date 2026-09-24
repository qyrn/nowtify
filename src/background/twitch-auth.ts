import { browser } from 'wxt/browser'
import { isRecord, readHttpsUrl, readNumber, readString } from '../shared/guards'
import type { AuthState, TwitchProfile } from '../shared/messages'
import { SILENT_LOGIN_INTERVAL, TOKEN_REVALIDATE_INTERVAL, TWITCH_CLIENT_ID } from './config'
import { getAuthenticatedUser } from './twitch-api'

type TokenCheck = 'valid' | 'invalid' | 'unreachable'

async function readStoredToken(): Promise<string | null> {
  const { twitchAuth } = await browser.storage.local.get('twitchAuth')
  return isRecord(twitchAuth) ? readString(twitchAuth, 'access_token') : null
}

async function readStoredProfile(): Promise<TwitchProfile | null> {
  const { twitchUser } = await browser.storage.local.get('twitchUser')
  if (!isRecord(twitchUser)) return null
  const id = readString(twitchUser, 'id')
  const login = readString(twitchUser, 'login')
  if (!id || !login) return null
  return {
    id,
    login,
    displayName: readString(twitchUser, 'displayName') ?? login,
    avatarUrl: readHttpsUrl(twitchUser, 'avatarUrl')
  }
}

async function readSessionNumber(key: string): Promise<number> {
  const stored = await browser.storage.session.get(key)
  return readNumber(stored, key) ?? 0
}

async function validateToken(token: string): Promise<TokenCheck> {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(10_000)
    })
    if (response.ok) return 'valid'
    return response.status === 401 ? 'invalid' : 'unreachable'
  } catch {
    return 'unreachable'
  }
}

async function runAuthFlow(interactive: boolean): Promise<string | null> {
  const state = crypto.randomUUID()
  const url = new URL('https://id.twitch.tv/oauth2/authorize')
  url.search = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: browser.identity.getRedirectURL(),
    response_type: 'token',
    scope: '',
    state
  }).toString()

  const responseUrl = await browser.identity.launchWebAuthFlow({ url: url.toString(), interactive })
  if (!responseUrl) return null
  const params = new URLSearchParams(new URL(responseUrl).hash.slice(1))
  if (params.get('state') !== state) return null
  return params.get('access_token')
}

async function storeToken(token: string): Promise<void> {
  await browser.storage.local.set({ twitchAuth: { access_token: token, obtained_at: Date.now() } })
  await browser.storage.local.remove('twitchLoggedOut')
  await browser.storage.session.set({ authExpired: false, tokenValidatedAt: Date.now() })
}

async function storeProfile(token: string): Promise<TwitchProfile | null> {
  const user = await getAuthenticatedUser(token)
  if (!user) return null
  const profile: TwitchProfile = {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  }
  await browser.storage.local.set({ twitchUser: profile })
  return profile
}

async function trySilentLogin(): Promise<string | null> {
  const { twitchLoggedOut } = await browser.storage.local.get('twitchLoggedOut')
  if (twitchLoggedOut === true) return null
  if (Date.now() - (await readSessionNumber('silentLoginAt')) < SILENT_LOGIN_INTERVAL) return null
  await browser.storage.session.set({ silentLoginAt: Date.now() })

  try {
    const token = await runAuthFlow(false)
    if (!token) return null
    await storeToken(token)
    return token
  } catch {
    return null
  }
}

export async function getToken(): Promise<string | null> {
  const token = await readStoredToken()
  if (!token) return trySilentLogin()

  if (Date.now() - (await readSessionNumber('tokenValidatedAt')) < TOKEN_REVALIDATE_INTERVAL) return token

  const check = await validateToken(token)
  if (check === 'valid') {
    await browser.storage.session.set({ tokenValidatedAt: Date.now() })
    return token
  }
  if (check === 'unreachable') return token

  await invalidateToken()
  return trySilentLogin()
}

export async function invalidateToken(): Promise<void> {
  await browser.storage.local.remove('twitchAuth')
  await browser.storage.session.set({ authExpired: true, tokenValidatedAt: 0 })
}

export async function login(): Promise<TwitchProfile> {
  const token = await runAuthFlow(true)
  if (!token) throw new Error(browser.i18n.getMessage('loginCancelledError'))
  await storeToken(token)
  const profile = await storeProfile(token)
  if (!profile) throw new Error(browser.i18n.getMessage('loginProfileError'))
  return profile
}

export async function logout(): Promise<void> {
  const token = await readStoredToken()
  await browser.storage.local.set({ twitchLoggedOut: true })
  await browser.storage.local.remove(['twitchAuth', 'twitchUser'])
  await browser.storage.session.set({ authExpired: false, tokenValidatedAt: 0 })
  if (!token) return
  await fetch('https://id.twitch.tv/oauth2/revoke', {
    method: 'POST',
    body: new URLSearchParams({ client_id: TWITCH_CLIENT_ID, token }),
    signal: AbortSignal.timeout(10_000)
  }).catch(() => null)
}

export async function getAuthState(): Promise<AuthState> {
  const token = await getToken()
  if (!token) {
    const { authExpired } = await browser.storage.session.get('authExpired')
    return authExpired === true ? { status: 'expired' } : { status: 'disconnected' }
  }
  const user = (await readStoredProfile()) ?? (await storeProfile(token).catch(() => null))
  return { status: 'connected', user }
}
