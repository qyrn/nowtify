import { readFile, writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

const ICON_SIZES = [16, 32, 48, 128] as const

const logo = await readFile(new URL('../branding/logo.svg', import.meta.url), 'utf8')

for (const size of ICON_SIZES) {
  const png = new Resvg(logo, { fitTo: { mode: 'width', value: size } }).render().asPng()
  await writeFile(new URL(`../public/icon-${String(size)}.png`, import.meta.url), png)
}
