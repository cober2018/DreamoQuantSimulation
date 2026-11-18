import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './src/site.config.mjs';

// sitemap 的 lastmod：这里只粗读 frontmatter 的几个字段，完整校验在 src/content.config.ts。
// 「草稿不发布」「标签少于 TAG_INDEX_MIN 篇不收录」两条规则要和 src/lib/blog.ts 保持一致。
const TAG_INDEX_MIN = 3;
const includeDrafts = process.env.BLOG_DRAFTS === '1';
const field = (fm, k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^['"]|['"]$/g, '');
const mdFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return mdFiles(p).map((x) => `${f}/${x}`);
    return f.endsWith('.md') && !f.startsWith('_') ? [f] : [];
  });
const frontmatter = (dir, f) => readFileSync(join(dir, f), 'utf8').split('---')[1] ?? '';

const blogDir = fileURLToPath(new URL('./src/content/blog/', import.meta.url));
const posts = mdFiles(blogDir)
  .map((f) => {
    const fm = frontmatter(blogDir, f);
    return {
      slug: f.replace(/\.md$/, ''),
      draft: field(fm, 'draft') !== 'false',
      date: field(fm, 'updatedDate') ?? field(fm, 'pubDate'),
      tags: (field(fm, 'tags') ?? '').replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean),
      category: field(fm, 'category'),
    };
  })
  .filter((p) => includeDrafts || !p.draft);
const docsDir = fileURLToPath(new URL('./src/content/docs/', import.meta.url));
const lastmod = new Map([
  ...posts.map((p) => [`/blog/${p.slug}/`, p.date]),
  ...mdFiles(docsDir).map((f) => [`/docs/${f.replace(/\.md$/, '')}/`, field(frontmatter(docsDir, f), 'updated')]),
]);
const tagCount = new Map();
for (const p of posts) for (const t of p.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
const usedCategories = new Set(posts.map((p) => p.category));
const path = (url) => new URL(url).pathname;

export default defineConfig({
  site: SITE.origin,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  // 代码块不做语法着色：默认配色在亮色下对比度不够，也和两套主题不协调
  markdown: { syntaxHighlight: false },
  vite: { server: { fs: { allow: ['..'] } } },
  integrations: [
    sitemap({
      filter: (url) => {
        const p = path(url);
        if (p === '/404/') return false;
        const tag = p.match(/^\/blog\/tag\/([^/]+)\/$/)?.[1];
        if (tag) return (tagCount.get(tag) ?? 0) >= TAG_INDEX_MIN;
        const cat = p.match(/^\/blog\/category\/([^/]+)\/$/)?.[1];
        if (cat) return usedCategories.has(cat);
        return true;
      },
      serialize: (item) => {
        const d = lastmod.get(path(item.url));
        return d ? { ...item, lastmod: new Date(d).toISOString() } : item;
      },
    }),
  ],
});
