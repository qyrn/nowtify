const SVG_NS = 'http://www.w3.org/2000/svg'

type Shape =
  | ['path', { d: string }]
  | ['circle', { cx: string; cy: string; r: string }]
  | ['rect', Record<string, string>]

const ICONS = {
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }]
  ],
  loader: [['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }]],
  gamepad: [
    ['path', { d: 'M6 11h4M8 9v4M15 12h.01M18 10h.01' }],
    [
      'path',
      {
        d: 'M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z'
      }
    ]
  ],
  eye: [
    [
      'path',
      {
        d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'
      }
    ],
    ['circle', { cx: '12', cy: '12', r: '3' }]
  ],
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
  bellOff: [
    ['path', { d: 'M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5' }],
    ['path', { d: 'M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7' }],
    ['path', { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' }],
    ['path', { d: 'm2 2 20 20' }]
  ],
  calendar: [
    ['rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }],
    ['path', { d: 'M16 2v4M8 2v4M3 10h18' }]
  ],
  close: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
  users: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }]
  ],
  clock: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 6v6l4 2' }]
  ]
} satisfies Record<string, Shape[]>

export type IconName = keyof typeof ICONS

export function icon(name: IconName, className = 'icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', className)
  for (const [tag, attributes] of ICONS[name] as Shape[]) {
    const shape = document.createElementNS(SVG_NS, tag)
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value)
    svg.append(shape)
  }
  return svg
}
