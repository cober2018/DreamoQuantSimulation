// Blog 的分类、标签白名单和公共函数。侧重市场数据方法论（ZS-115 §三），新增标签先改这里。
import type { CollectionEntry } from 'astro:content';

export const categories = [
  { id: 'methodology', label: '口径解读' },
  { id: 'statistics', label: '统计方法' },
  { id: 'mcp-llm', label: 'MCP 与大模型' },
  { id: 'principles', label: '方法与原则' },
] as const;
export const categoryIds = categories.map((c) => c.id) as unknown as [string, ...string[]];

export const tags = [
  { id: 'participation', label: '成交与参与度' },
  { id: 'derivatives', label: '股指期货' },
  { id: 'percentile', label: '分位' },
  { id: 'zscore', label: '标准分' },
  { id: 'data-quality', label: '数据质量' },
  { id: 'mcp', label: 'MCP' },
  { id: 'llm', label: '大模型' },
  { id: 'daily-review', label: '盘后复盘' },
  { id: 'facts-only', label: '只给事实' },
  { id: 'geo-seo', label: 'GEO / SEO' },
] as const;
export const tagIds = tags.map((t) => t.id) as unknown as [string, ...string[]];

export const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
export const tagLabel = (id: string) => tags.find((t) => t.id === id)?.label ?? id;

/** 标签页文章少于这个数就加 noindex，也不进 sitemap（astro.config.mjs 里同名常量要一致） */
export const TAG_INDEX_MIN = 3;
export const PAGE_SIZE = 10;

/** 生产构建只收已发布的文章；本地预览草稿用 BLOG_DRAFTS=1 */
export const includeDrafts = process.env.BLOG_DRAFTS === '1';
export const isVisible = (e: CollectionEntry<'blog'>) => includeDrafts || !e.data.draft;
export const byDateDesc = (a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

/** 短简介不手写：一律取长版 bio 的第一句（ZS-115 §十） */
export const bioShort = (bio: string) => {
  const i = bio.indexOf('。');
  return i === -1 ? bio.trim() : bio.slice(0, i + 1).trim();
};
export const bioParagraphs = (bio: string) => bio.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
