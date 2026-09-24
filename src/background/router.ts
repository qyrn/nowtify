import { browser, type Browser } from 'wxt/browser'
import { isEnvelope, type Reply } from '../shared/messages'
import { handlers } from './handlers'

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function routeMessage(
  message: unknown,
  sender: Browser.runtime.MessageSender,
  sendResponse: (reply: Reply) => void
): boolean {
  if (sender.id !== browser.runtime.id || !isEnvelope(message)) return false
  const handler = handlers[message.type] as (payload: unknown) => Promise<unknown>
  handler(message.payload).then(
    (data) => {
      sendResponse({ ok: true, data })
    },
    (error: unknown) => {
      sendResponse({ ok: false, error: describe(error) })
    }
  )
  return true
}
