type Child = Node | string | null | false
type Attributes = Record<string, string | boolean | null>

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: Child[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === false) continue
    if (name === 'class') element.className = String(value)
    else element.setAttribute(name, value === true ? '' : value)
  }
  for (const child of children) {
    if (child !== null && child !== false) element.append(child)
  }
  return element
}

export function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const element = document.getElementById(id)
  if (!(element instanceof type)) throw new Error(`Missing element #${id}`)
  return element
}

export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, '')
  return (letters.slice(0, 2) || '?').toUpperCase()
}

export function avatar(url: string | null, name: string, className: string): HTMLElement {
  const fallback = h('span', { class: `${className} avatar-fallback`, 'aria-hidden': 'true' }, [
    initials(name)
  ])
  if (!url) return fallback
  const image = h('img', {
    class: className,
    src: url,
    alt: '',
    loading: 'lazy',
    referrerpolicy: 'no-referrer'
  })
  image.addEventListener('error', () => {
    image.replaceWith(fallback)
  })
  return image
}
