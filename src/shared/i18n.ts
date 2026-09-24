import { browser } from 'wxt/browser'

export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0]

export function t(key: MessageKey, ...substitutions: (string | number)[]): string {
  return browser.i18n.getMessage(key, substitutions.map(String))
}

export function locale(): string {
  return browser.i18n.getUILanguage()
}

function translateAttribute(
  root: ParentNode,
  attribute: string,
  apply: (element: HTMLElement, text: string) => void
) {
  root.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((element) => {
    const key = element.getAttribute(attribute)
    if (key) apply(element, browser.i18n.getMessage(key as MessageKey))
  })
}

export function translatePage(): void {
  document.documentElement.lang = locale()
  translateAttribute(document, 'data-i18n', (element, text) => {
    element.textContent = text
  })
  translateAttribute(document, 'data-i18n-title', (element, text) => {
    element.title = text
    element.setAttribute('aria-label', text)
  })
  translateAttribute(document, 'data-i18n-placeholder', (element, text) => {
    element.setAttribute('placeholder', text)
  })
}

export function plural(count: number, one: MessageKey, other: MessageKey): string {
  return t(new Intl.PluralRules(locale()).select(count) === 'one' ? one : other, count)
}
