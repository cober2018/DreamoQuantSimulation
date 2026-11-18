// 构建时把页面 HTML 里的 %MCP_URL% 换成 site.config.mjs 的常量（文档正文、代码块都在内）。
// 只处理 HTML，替换值做 HTML 转义，避免占位符「<上线后公布>」被当成标签。
import { defineMiddleware } from 'astro:middleware';
import { MCP_URL } from './site.config.mjs';

const escaped = MCP_URL.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  const html = await res.text();
  return new Response(html.replaceAll('%MCP_URL%', escaped), { status: res.status, headers: res.headers });
});
