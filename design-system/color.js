// hsl(H S% L% / A) → rgb()/rgba()。ECharts 的 zrender 和部分小程序基础库不认 CSS4 空格分隔的 hsl 写法。
export function hslToRgba(hsl) {
  const m = String(hsl).match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)/)
  if (!m) return hsl
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100, a = m[4] === undefined ? 1 : +m[4]
  const f = (n) => {
    const k = (n + h * 12) % 12
    return Math.round((l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
  }
  return a === 1 ? `rgb(${f(0)}, ${f(8)}, ${f(4)})` : `rgba(${f(0)}, ${f(8)}, ${f(4)}, ${a})`
}
