# 字体说明

| 文件 | 来源 | 授权 | 说明 |
|---|---|---|---|
| zx-serif.woff2 | 思源宋体 Source Han Serif CN Regular（Adobe） | SIL Open Font License 1.1（https://openfontlicense.org） | 子集，只含展示文字用到的字符（公开站构建产物里 class 含 display 的元素用到的字）；按 OFL 要求改了内部字体名（ZX Serif），不与原字体名混用 |

重新生成：`FONT_SRC=<SourceHanSerifCN-Regular 路径> python3 scripts/subset-fonts.py（先 npm run build，生成后再 build 一次）`（woff2 压缩需要 brotli）。
