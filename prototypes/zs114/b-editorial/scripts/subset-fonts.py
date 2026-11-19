"""把 Noto Serif SC（SIL OFL 1.1）按本原型实际用到的字裁成 woff2。
用法：python3 scripts/subset-fonts.py <NotoSerifSC[wght].ttf>
字集 = src 下所有源码 + 共享数据里会显示的文字 + 常用标点和 ASCII。"""
import json, pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT.parent / 'data'
chars = set(chr(c) for c in range(0x20, 0x7f)) | set('，。、；：？！「」『』（）《》〈〉…—–·／％＋－↩→←↑↓↕‹›◆Δ≡⇄№◷★☆§ⅠⅡⅢⅣ①②③④⑤⑥≥≤−±×')
for p in (ROOT / 'src').rglob('*'):
    if p.suffix in ('.vue', '.js'):
        chars |= set(p.read_text('utf-8'))
def walk(x):
    if isinstance(x, str): chars.update(x)
    elif isinstance(x, dict): [walk(v) for v in x.values()]
    elif isinstance(x, list): [walk(v) for v in x]
walk(json.loads((DATA / 'brief-replay.json').read_text('utf-8')))
for it in json.loads((DATA / 'industries-sample.json').read_text('utf-8'))['data']['items']:
    chars.update(it['sector_name'])
text = ''.join(sorted(c for c in chars if ord(c) >= 0x20))
# 900 只用于大标题和字标，单独裁一份很小的字集
TITLES = '知数星耀盘后纪要今日要点市场总览参与度与资金环境行业比较与轮动题材与涨跌结构历史复盘事件日历明细页五种数据状态盘后的事实，排好版，注明出处。一条要点，六样东西栏目原型未实现此页0123456789'
titles = ''.join(sorted(set(TITLES)))
src = sys.argv[1]
for w, txt in ((600, text), (900, titles)):
    f = TTFont(src)
    f = instantiateVariableFont(f, {'wght': w})
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'liga', 'tnum', 'lnum', 'pnum', 'palt', 'vert']
    opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(text=txt); s.subset(f)
    out = ROOT / 'public' / 'fonts' / f'zs-serif-{w}.woff2'
    f.flavor = 'woff2'; f.save(out)
    print(out.name, round(out.stat().st_size / 1024, 1), 'KB')
print('glyph chars:', len(text))
