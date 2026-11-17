import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as t from '../src/design/tokens.js'

const kebab = (s) => s.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()
const vars = (obj, prefix) => Object.entries(obj).map(([k, v]) => `  --${prefix}-${kebab(k)}: ${v};`).join('\n')

const common = [
  `  --font-sans: ${t.font.sans};`, `  --font-display: ${t.font.display};`, `  --font-mono: ${t.font.mono};`,
  ...Object.entries(t.type).flatMap(([k, [s, l]]) => [`  --fs-${k}: ${s}px;`, `  --lh-${k}: ${l}px;`]),
  vars(Object.fromEntries(Object.entries(t.space).map(([k, v]) => [k, `${v}px`])), 'sp'),
  vars(Object.fromEntries(Object.entries(t.radius).map(([k, v]) => [k, `${v}px`])), 'r'),
  ...['fast', 'base', 'slow', 'tick', 'draw'].map((k) => `  --dur-${k}: ${t.motion[k]}ms;`),
  `  --ease: ${t.motion.ease};`,
  `  --grid-cols: ${t.grid.columns};`, `  --max-w: ${t.grid.maxWidth}px;`,
].join('\n')

const shadows = (m) => Object.entries(t.shadow[m]).map(([k, v]) => `  --shadow-${k}: ${v};`).join('\n')

const css = `/* 由 scripts/gen-tokens.mjs 从 src/design/tokens.js 生成，勿手改 */
:root {
${common}
  color-scheme: light;
${vars(t.color.light, 'c')}
${shadows('light')}
}
:root[data-theme='dark'] {
  color-scheme: dark;
${vars(t.color.dark, 'c')}
${shadows('dark')}
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; --dur-tick: 0ms; --dur-draw: 0ms; }
}
`
const out = (p) => fileURLToPath(new URL(p, import.meta.url))
writeFileSync(out('../src/design/tokens.css'), css)
writeFileSync(out('../src/design/tokens.json'), JSON.stringify({ color: t.color, font: t.font, type: t.type, space: t.space, radius: t.radius, shadow: t.shadow, motion: t.motion, grid: t.grid }, null, 2) + '\n')
console.log('tokens written')
