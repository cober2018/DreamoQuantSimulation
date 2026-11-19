// 从 tokens.json 生成 tokens.css：暗色为默认（:root），亮色挂在 [data-theme="light"]。
import { readFileSync, writeFileSync } from 'node:fs'
const t = JSON.parse(readFileSync(new URL('../src/theme/tokens.json', import.meta.url)))
const block = (prefix, obj) => Object.entries(obj).map(([k, v]) => `  --${prefix}${k}: ${v};`).join('\n')
const shared = [
  block('font-', t.font), block('fs-', t.fontSize), block('lh-', t.lineHeight),
  block('s-', t.space), block('r-', t.radius), block('', t.motion),
].join('\n')
const css = `/* 由 scripts/gen-tokens.mjs 生成，勿手改；改 tokens.json 后运行 node scripts/gen-tokens.mjs */
:root, [data-theme="dark"] {
  color-scheme: dark;
${shared}
${block('c-', t.color.dark)}
${block('shadow-', t.shadow.dark)}
}
[data-theme="light"] {
  color-scheme: light;
${block('c-', t.color.light)}
${block('shadow-', t.shadow.light)}
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-1: 0ms; --dur-2: 0ms; --dur-3: 0ms; --dur-slow: 0ms; }
}
`
writeFileSync(new URL('../src/theme/tokens.css', import.meta.url), css)
console.log('tokens.css written')
