"""展示字体子集：思源宋体 CN Regular（SIL OFL 1.1），只保留 class="display" 元素和介绍页大字用到的字，外加数字与基本符号。
源字体不入库：FONT_SRC 指向 SourceHanSerifCN-Regular.ttf/otf。woff2 压缩需要 brotli（可 pip install --target 到临时目录后用 PYTHONPATH 引入）。
用法：FONT_SRC=… python3 scripts/subset-fonts.py"""
import os, re, glob
from fontTools import subset

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set("0123456789+-−.,%/ ·")
for f in glob.glob(os.path.join(root, 'src', '**', '*.vue'), recursive=True):
    s = open(f, encoding='utf-8').read()
    for m in re.finditer(r'class="[^"]*\b(display|lead)\b[^"]*"[^>]*>([\s\S]*?)</', s):
        chars |= set(re.sub(r'\{\{[^}]*\}\}|<[^>]+>', '', m.group(2)))
# 动态写入 display 元素的文字：数据页名称
brief = open(os.path.join(root, 'src', 'lib', 'brief.js'), encoding='utf-8').read()
for m in re.finditer(r"label: '([^']+)'", brief):
    chars |= set(m.group(1))
# 动态写入 display 元素的文字：介绍页文案两个版本（copy.js）、占位页标题（main.js）
for name in ('copy.js', 'main.js'):
    txt = open(os.path.join(root, 'src', name), encoding='utf-8').read()
    for m in re.finditer(r"(?:heroLead|traceTitle|pagesTitle|title): ['`]([^'`]+)['`]", txt):
        chars |= set(re.sub(r'<[^>]+>|\$\{[^}]*\}', '', m.group(1)))
chars = {c for c in chars if not c.isspace() or c == ' '}
src = os.environ['FONT_SRC']
out = os.path.join(root, 'public', 'fonts', 'zx-serif.woff2')
opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'palt', 'tnum']; opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]; opts.hinting = False
font = subset.load_font(src, opts)
s = subset.Subsetter(opts); s.populate(text=''.join(sorted(chars))); s.subset(font)
# 改内部名称，避免与系统安装的原字体混淆（OFL 对保留字体名的要求）
for rec in font['name'].names:
    if rec.nameID in (1, 4, 16): rec.string = 'ZX Serif'
    if rec.nameID == 6: rec.string = 'ZXSerif-Regular'
subset.save_font(font, out, opts)
print(len(chars), 'chars ->', out, os.path.getsize(out), 'bytes')
