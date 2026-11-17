#!/usr/bin/env bash
# 展示标题字体：思源黑体 SC Bold（SIL OFL 1.1）按页面标题实际用字做子集，输出 woff2
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${SRC_FONT:-$HOME/Library/Fonts/SourceHanSansSC-Bold.otf}"
CHARS=$(cat scripts/display-chars.txt | tr -d '\n')
pyftsubset "$SRC" --text="$CHARS" --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize --output-file=public/fonts/zs-display-700.woff2
ls -la public/fonts/zs-display-700.woff2
# 拉丁字体（OFL 1.1）复制到 public/fonts，固定路径便于 preload，减少字体替换造成的布局偏移
cp node_modules/@fontsource/inter/files/inter-latin-{400,600}-normal.woff2 public/fonts/
cp node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-{400,500}-normal.woff2 public/fonts/
