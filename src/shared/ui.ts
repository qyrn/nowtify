import { h } from './dom'
import { t } from './i18n'

export interface DialogAction<T> {
  label: string
  value: T
  variant?: 'primary' | 'danger' | 'neutral'
}

export function dialog<T>(title: string, message: string, actions: DialogAction<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    const buttons = actions.map((action) =>
      h('button', { type: 'button', class: `ui-btn ui-btn-${action.variant ?? 'neutral'}` }, [action.label])
    )
    const titleId = `dialog-title-${crypto.randomUUID()}`
    const modal = h(
      'div',
      { class: 'ui-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      [
        h('p', { class: 'ui-modal-title', id: titleId }, [title]),
        h('p', { class: 'ui-modal-message' }, [message]),
        h('div', { class: 'ui-modal-actions' }, buttons)
      ]
    )
    const overlay = h('div', { class: 'ui-overlay' }, [modal])
    const previousFocus = document.activeElement

    const close = (value: T | null) => {
      document.removeEventListener('keydown', onKey)
      overlay.remove()
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
      resolve(value)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(null)
    }

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        close(actions[index]?.value ?? null)
      })
    })
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null)
    })
    document.addEventListener('keydown', onKey)
    document.body.append(overlay)
    buttons.at(-1)?.focus()
  })
}

export async function confirmDanger(title: string, message: string, confirmLabel: string): Promise<boolean> {
  const answer = await dialog(title, message, [
    { label: t('cancelLabel'), value: false },
    { label: confirmLabel, value: true, variant: 'danger' }
  ])
  return answer === true
}

export function toast(message: string, tone: 'success' | 'error' | 'info' = 'info'): void {
  let stack = document.querySelector('.ui-toast-stack')
  if (!stack) {
    stack = h('div', { class: 'ui-toast-stack', role: 'status', 'aria-live': 'polite' })
    document.body.append(stack)
  }
  const item = h('div', { class: `ui-toast ui-toast-${tone}` }, [message])
  stack.append(item)
  setTimeout(() => {
    item.classList.add('leaving')
    setTimeout(() => {
      item.remove()
    }, 200)
  }, 3500)
}
