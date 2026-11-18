// 文档左栏分组（ZS-115 §三）。页面归哪一组、组内顺序写在各篇 frontmatter 的 group / order 里。
import type { CollectionEntry } from 'astro:content';

export const groups = [
  { id: 'start', label: '开始使用' },
  { id: 'brief', label: '每日要点' },
  { id: 'pages', label: '明细页' },
  { id: 'mcp', label: 'MCP 接入' },
  { id: 'reference', label: '参考' },
] as const;
export const groupIds = groups.map((g) => g.id) as unknown as [string, ...string[]];
export const groupLabel = (id: string) => groups.find((g) => g.id === id)?.label ?? id;

type Doc = CollectionEntry<'docs'>;
export const docOrder = (a: Doc, b: Doc) =>
  groupIds.indexOf(a.data.group) - groupIds.indexOf(b.data.group) || a.data.order - b.data.order;
export const docHref = (d: Doc) => `/docs/${d.id}/`;
