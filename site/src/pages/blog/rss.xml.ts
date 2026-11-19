// /blog/rss.xml：只收已发布的文章；内容是标题和摘要
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../../site.config.mjs';
import { isVisible, byDateDesc, categoryLabel } from '../../lib/blog';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const items = (await getCollection('blog', isVisible)).sort(byDateDesc);
  const o = SITE.origin;
  const body = items
    .map((e) => {
      const link = `${o}/blog/${e.id}/`;
      return `<item><title>${esc(e.data.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${e.data.pubDate.toUTCString()}</pubDate><category>${esc(categoryLabel(e.data.category))}</category><description>${esc(e.data.description)}</description></item>`;
    })
    .join('');
  const last = items[0] ? `<lastBuildDate>${(items[0].data.updatedDate ?? items[0].data.pubDate).toUTCString()}</lastBuildDate>` : '';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>知数星耀 博客</title><link>${o}/blog/</link><atom:link href="${o}/blog/rss.xml" rel="self" type="application/rss+xml"/><description>市场数据方法论：口径怎么读、统计方法、怎样用 MCP 让大模型读数据。</description><language>zh-cn</language>${last}${body}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
