"""公开站展示字体子集：思源宋体 CN Regular（SIL OFL 1.1），内部改名 ZX Serif，与 S1 参考实现同源同名。
只保留构建产物里 class 含 display 的元素用到的字，外加数字与基本符号。源字体不入库。
用法：先 npm run build，再 FONT_SRC=<SourceHanSerifCN-Regular 路径> python3 scripts/subset-fonts.py，然后再 build 一次。
woff2 压缩需要 brotli。"""
import os, re, glob, html
from fontTools import subset

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set("0123456789+-−.,%/ ·：，。、「」")
for f in glob.glob(os.path.join(root, 'dist', '**', '*.html'), recursive=True):
    s = open(f, encoding='utf-8').read()
    for m in re.finditer(r'<(h1|h2|span|p)\b[^>]*class="[^"]*\bdisplay\b[^"]*"[^>]*>([\s\S]*?)</\1>', s):
        chars |= set(html.unescape(re.sub(r'<[^>]+>', '', m.group(2))))
chars = {c for c in chars if not c.isspace() or c == ' '}
out = os.path.join(root, 'public', 'fonts', 'zx-serif.woff2')
opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'palt', 'tnum']
opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]; opts.hinting = False
font = subset.load_font(os.environ['FONT_SRC'], opts)
s = subset.Subsetter(opts); s.populate(text=''.join(sorted(chars))); s.subset(font)
# OFL：修改版不使用保留字体名
for rec in font['name'].names:
    if rec.nameID in (1, 4, 16): rec.string = 'ZX Serif'
    if rec.nameID == 6: rec.string = 'ZXSerif-Regular'
subset.save_font(font, out, opts)
print(len(chars), 'chars ->', out, os.path.getsize(out), 'bytes')
