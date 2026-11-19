// 从 tokens.json 生成 dist/tokens.css（Web SPA / Astro）和 dist/tokens.scss（uni-app 小程序）。
// 用法：node design-system/build.mjs（无依赖，Node 18+）
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { hslToRgba } from './color.js'

const here = (p) => new URL(p, import.meta.url)
const t = JSON.parse(readFileSync(here('./tokens.json'), 'utf8'))
const HEAD = '由 design-system/build.mjs 从 tokens.json 生成，勿手改'

// ---------- CSS ----------
const vars = (prefix, obj, indent = '  ') => Object.entries(obj).map(([k, v]) => `${indent}--${prefix}${k}: ${v};`).join('\n')
const shared = [
  vars('font-', t.font), vars('fs-', t.fontSize), vars('lh-', t.lineHeight), vars('tr-', t.tracking),
  vars('s-', t.space), vars('r-', t.radius), vars('dur-', t.motion.duration), vars('ease-', t.motion.easing),
  vars('z-', t.z), vars('bp-', t.breakpoint),
].join('\n')
const theme = (mode, indent) => [`${indent}color-scheme: ${mode};`, vars('c-', t.color[mode], indent), vars('shadow-', t.shadow[mode], indent)].join('\n')

// 亮色是 :root 默认；显式 data-theme 优先；没有显式选择时跟随系统
const css = `/* ${HEAD} */
:root {
${shared}
${theme('light', '  ')}
}
[data-theme="dark"] {
${theme('dark', '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${theme('dark', '    ')}
  }
}
@media (prefers-reduced-motion: reduce) {
  :root {
${Object.keys(t.motion.duration).map((k) => `    --dur-${k}: 0ms;`).join('\n')}
  }
}
`

// ---------- SCSS（小程序） ----------
// 小程序按 750rpx 设计稿：1px（375 宽）= 2rpx；颜色转成 rgb/rgba。
const rpx = (v) => String(v).replace(/(-?\d*\.?\d+)px/g, (_, n) => `${+n * 2}rpx`)
const shadowRgba = (v) => v.replace(/hsl\([^)]*\)/g, hslToRgba)
const scssVars = (prefix, obj, map = (v) => v) => Object.entries(obj).map(([k, v]) => `$zx-${prefix}${k}: ${map(v)};`).join('\n')
const scssMap = (name, obj, map = (v) => v) => `$zx-${name}: (\n${Object.entries(obj).map(([k, v]) => `  "${k}": ${map(v)},`).join('\n')}\n);`
const fsMp = Object.fromEntries(Object.entries(t.fontSize).filter(([k]) => k !== 'display'))

const scss = `// ${HEAD}
// 约定：尺寸已换算成 rpx（750 设计稿，375 宽下 1px = 2rpx）；颜色是 rgb/rgba。
// 用法：在 App.vue 里 @include zx-page-theme;，组件里用 var(--c-ink) 等与 Web 同名的 CSS 变量，
// 或直接用 $zx-* 常量（尺寸类）。暗色跟随系统（需在 manifest 开启 darkmode）。

${scssVars('font-', t.font)}
${scssVars('fs-', fsMp, rpx)}
${scssVars('lh-', t.lineHeight)}
${scssVars('s-', t.space, rpx)}
${scssVars('r-', t.radius, rpx)}
${scssVars('dur-', t.motion.duration)}
${scssVars('ease-', t.motion.easing)}
${scssVars('z-', t.z)}

${scssMap('colors-light', t.color.light, hslToRgba)}
${scssMap('colors-dark', t.color.dark, hslToRgba)}
${scssMap('shadow-light', t.shadow.light, (v) => `(${rpx(shadowRgba(v))})`)}
${scssMap('shadow-dark', t.shadow.dark, (v) => `(${rpx(shadowRgba(v))})`)}

@function zx-color($mode, $key) {
  @if $mode == dark { @return map-get($zx-colors-dark, $key); }
  @return map-get($zx-colors-light, $key);
}

// 输出与 Web 同名的 CSS 变量（--c-*、--shadow-*、--s-*、--fs-*、--r-*），组件写法三端一致
@mixin zx-theme-vars($mode: light) {
  $colors: $zx-colors-light;
  $shadows: $zx-shadow-light;
  @if $mode == dark { $colors: $zx-colors-dark; $shadows: $zx-shadow-dark; }
  @each $k, $v in $colors { --c-#{$k}: #{$v}; }
  @each $k, $v in $shadows { --shadow-#{$k}: #{$v}; }
}
@mixin zx-scale-vars {
${Object.entries(t.space).map(([k, v]) => `  --s-${k}: ${rpx(v)};`).join('\n')}
${Object.entries(fsMp).map(([k, v]) => `  --fs-${k}: ${rpx(v)};`).join('\n')}
${Object.entries(t.radius).map(([k, v]) => `  --r-${k}: ${rpx(v)};`).join('\n')}
  --font-display: #{$zx-font-display};
  --font-sans: #{$zx-font-sans};
  --font-mono: #{$zx-font-mono};
}
// 小程序页面根：亮色默认，系统暗色时切换
@mixin zx-page-theme {
  page {
    @include zx-scale-vars;
    @include zx-theme-vars(light);
    background: map-get($zx-colors-light, "bg");
    color: map-get($zx-colors-light, "ink");
  }
  @media (prefers-color-scheme: dark) {
    page {
      @include zx-theme-vars(dark);
      background: map-get($zx-colors-dark, "bg");
      color: map-get($zx-colors-dark, "ink");
    }
  }
}
`

mkdirSync(here('./dist/'), { recursive: true })
writeFileSync(here('./dist/tokens.css'), css)
writeFileSync(here('./dist/tokens.scss'), scss)
console.log('design-system: dist/tokens.css, dist/tokens.scss written')
