"""构建后把介绍页预渲染成静态 HTML（dist/landing.html），首屏不等 JS 就能画出来。
用法：先 npm run build && npm run preview，再 python3 scripts/prerender.py http://127.0.0.1:4792
Vue 挂载时会用同样的内容替换，不是 hydration；文案或结构改了要重新跑。"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/')
dist = pathlib.Path(__file__).resolve().parent.parent / 'dist'
shell = (dist / 'index.html').read_text('utf-8')
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(reduced_motion='reduce')
    pg.goto(base + '/landing?theme=light', wait_until='networkidle')
    html = pg.eval_on_selector('#app', 'el => el.innerHTML')
    b.close()
out = shell.replace('<div id="app"></div>', f'<div id="app">{html}</div>')
out = re.sub(r'<title>.*?</title>', '<title>知数星耀 · A 股盘后数据，每条事实注明出处</title>', out)
(dist / 'landing.html').write_text(out, 'utf-8')
print('landing.html', len(out))
