// /llms.txt：给大模型读的站点说明（https://llmstxt.org 格式）。文档、文章列表随内容集合自动生成。
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../site.config.mjs';
import { groups, docOrder } from '../lib/docs';
import { isVisible, byDateDesc } from '../lib/blog';

export const GET: APIRoute = async () => {
  const o = SITE.origin;
  const docs = (await getCollection('docs')).sort(docOrder);
  const posts = (await getCollection('blog', isVisible)).sort(byDateDesc);
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    '知数星耀只提供市场数据与历史统计，不提供分析结论、证券推荐或任何投资建议。每个数字都标明数据日期、口径和来源；某日缺数时直接说明缺失，不用其他日期代替。标注「待补」的页面内容尚未完成。',
    '',
    ...groups.flatMap((g) => [
      `## 文档：${g.label}`,
      '',
      ...docs.filter((d) => d.data.group === g.id).map((d) => `- [${d.data.title}](${o}/docs/${d.id}/)${d.data.status === 'stub' ? '（待补）' : ''}: ${d.data.lede}`),
      '',
    ]),
    '## 博客',
    '',
    ...(posts.length ? posts.map((p) => `- [${p.data.title}](${o}/blog/${p.id}/): ${p.data.description}`) : ['- 暂无已发布文章']),
    '',
    '## 其他',
    '',
    `- [价格与权益](${o}/pricing/): 免费版、VIP、SVIP 的权益对照；档位与价格待公布`,
    `- [关注知数Talk 主理人](${o}/follow/): 公众号、抖音、小红书`,
    `- [博客 RSS](${o}/blog/rss.xml)`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
