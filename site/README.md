# 知数星耀公开站（Astro，ZS-115 S4–S6）

dk.dreamotech.cn 的公开静态页：价格与权益、文档、博客、关注主理人。平台（登录、六个明细页、`/terms`）仍是 Vue SPA，部署时两边产物合并（ZS-115 §三），本站只链接过去。介绍页 `/` 属于 S7，本站暂不出 `/index.html`，部署时由 SPA 兜底。

## 运行

```bash
npm install
npm run build          # prebuild 先跑 ../design-system/build.mjs 生成 tokens.css
npm run preview        # http://localhost:4392
BLOG_DRAFTS=1 npm run build   # 本地预览草稿（生产构建不含 draft: true 的文章）
SOCIAL_DRAFTS=1 npm run build # 把 ready=false 的自媒体卡片也构建进去
```

依赖锁定精确版本：astro 7.4.12、@astrojs/sitemap 3.7.5。

## 结构

| 路径 | 内容 |
|---|---|
| `src/site.config.mjs` | 全站常量：站点地址、ICP、免责声明、**MCP 服务地址 `MCP_URL`（上线前是 `<上线后公布>`，只改这一行）**、SPA 链接 |
| `src/middleware.ts` | 构建时把 HTML 里的 `%MCP_URL%` 换成上面的常量（文档正文、代码块） |
| `src/data/pricing.json` | 价格与权益页的唯一数据源；价格、额度公布前都是「待公布」 |
| `src/data/social.json` | 自媒体卡片的唯一数据源（与 S1 参考实现相同） |
| `src/content.config.ts` | 集合：`docs`（分组 / 顺序 / 最后更新 / stub 标记）、`blog`（zod：标签白名单、draft 默认 true、faq、related → docs）、`authors` |
| `src/content/authors/zhishutalk.json` | 作者「知数Talk 主理人」，`bio` 存长版全文；短简介构建时取第一句（`lib/blog.ts` `bioShort`） |
| `src/layouts/Base.astro` | 页头页脚、主题（首帧前决定）、跳转链接、SEO / OG / JSON-LD |
| `src/layouts/DocLayout.astro` | 文档模板：左栏分组、面包屑、导语、本页目录、上一篇 / 下一篇、最后更新、复制按钮、客户端页签 |
| `src/pages/blog/` | 列表 + 分页、分类、标签（少于 3 篇 noindex 且不进 sitemap）、作者页、文章页（Article JSON-LD、作者卡片、相关文档、相关文章）、`rss.xml` |
| `src/pages/llms.txt.ts` | `/llms.txt`，随文档和文章自动生成 |
| `scripts/subset-fonts.py` | 展示字体子集（思源宋体，OFL，内部名 ZX Serif）；先 build，再跑脚本，再 build |

样式只用 `../design-system/dist/tokens.css` 的变量，本目录不存 token 值。

## 写文档的约定

- 每篇 frontmatter：`title`、`lede`（一句话导语）、`group`、`order`、`updated`、`status`（`stub` 显示「待补」）。
- 客户端页签：`<div data-tabs>` 里每个 `<section>` 以 `###` 标题开头，脚本把标题变成页签；没有脚本时全部按顺序展开。
- MCP 地址一律写 `%MCP_URL%`；令牌只写前缀 `zsmcp_`。
- 只写事实，不写建议性的说法；发布前过禁用词扫描。
