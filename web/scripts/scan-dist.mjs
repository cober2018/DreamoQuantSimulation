// 构建产物扫描: 无 sourcemap、无上游 Key 与密钥常量
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../dist', import.meta.url).pathname
const bad = []
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (f.endsWith('.map')) bad.push(`sourcemap: ${p}`)
    if (/\.(js|html|css)$/.test(f)) {
      const t = readFileSync(p, 'utf8')
      for (const re of [/dodk_[0-9a-f]{20,}/, /INSIGHT_UPSTREAM_API_KEY/, /INSIGHT_JWT_SECRET/, /sourceMappingURL/, /AppSecret\s*[:=]\s*['"][0-9a-f]{16,}/i])
        if (re.test(t)) bad.push(`${re}: ${p}`)
    }
  }
}
walk(root)
if (bad.length) { console.error('SCAN FAIL\n' + bad.join('\n')); process.exit(1) }
console.log('SCAN OK: 无 sourcemap, 无 Key/密钥常量')
