// 首屏后加载衬线子集，不占关键路径
const FACES = [
  ['/fonts/zs-serif-900.woff2', { weight: '800 900' }],
  ['/fonts/zs-serif-600.woff2', { weight: '500 700' }],
]
export function loadSerif() {
  const run = () => FACES.forEach(([url, desc]) => {
    const f = new FontFace('ZS Serif', `url(${url}) format('woff2')`, { display: 'swap', ...desc })
    f.load().then(() => document.fonts.add(f)).catch(() => { /* 回落系统宋体即可 */ })
  })
  if (document.readyState === 'complete') run()
  else addEventListener('load', run, { once: true })
}
