// 生产构建后处理: 对 dist 内 JS 做混淆 (抬高逆向成本; 真正的权限边界在服务端)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import JavaScriptObfuscator from 'javascript-obfuscator'

const dir = new URL('../dist/assets', import.meta.url).pathname
let n = 0
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js')) continue
  const p = join(dir, f)
  // echarts 等第三方大包只做轻量处理, 业务代码做字符串数组与标识符重命名
  const small = statSync(p).size < 400_000
  const out = JavaScriptObfuscator.obfuscate(readFileSync(p, 'utf8'), {
    compact: true, simplify: true, renameGlobals: false,
    stringArray: small, stringArrayEncoding: small ? ['base64'] : [], stringArrayThreshold: 0.75,
    identifierNamesGenerator: 'hexadecimal', splitStrings: false, controlFlowFlattening: false,
    deadCodeInjection: false, selfDefending: false, debugProtection: false, disableConsoleOutput: true,
    sourceMap: false, target: 'browser',
  })
  writeFileSync(p, out.getObfuscatedCode())
  n += 1
}
console.log(`obfuscated ${n} files`)
