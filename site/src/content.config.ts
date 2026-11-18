// 内容集合：文档、博客、作者。frontmatter 不合规时构建直接失败。
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { groupIds } from './lib/docs';
import { categoryIds, tagIds } from './lib/blog';

const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/[^_]*.md' }),
  schema: z.object({
    title: z.string().max(24),
    /** 一句话导语，也用作 meta description 和 llms.txt 的说明 */
    lede: z.string().min(12).max(90),
    group: z.enum(groupIds),
    order: z.number().int(),
    updated: z.coerce.date(),
    /** stub = 只有简要说明，正文待补 */
    status: z.enum(['ready', 'stub']).default('ready'),
  }),
});

const blog = defineCollection({
  // 下划线开头的文件不加载（留给模板、备注）
  loader: glob({ base: './src/content/blog', pattern: '**/[^_]*.md' }),
  schema: z.object({
    title: z.string().max(32),
    description: z.string().min(40).max(110),
    category: z.enum(categoryIds),
    tags: z.array(z.enum(tagIds)).min(1).max(5),
    author: reference('authors'),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(true),
    /** 文中真有问答时才写，用于 FAQPage；问答必须和正文一致 */
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    /** 相关文档页（docs 集合的 id，如 brief/how-to-read），不存在的 id 构建报错 */
    related: z.array(reference('docs')).default([]),
  }),
});

const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '*.json' }),
  schema: z.object({
    name: z.string(),
    /** 长版全文；短简介在构建时取第一句（lib/blog.ts bioShort），不另存 */
    bio: z.string(),
    kind: z.enum(['organization', 'person']),
  }),
});

export const collections = { docs, blog, authors };
