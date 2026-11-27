// 用户协议、隐私政策的正文数据结构，以及唯一一处生效日期（发版日期变了只改这里）
export const EFFECTIVE_DATE = '2026-11-27'

export type Block = string | { list: string[] } | { table: { head: string[]; rows: string[][] } }
export type LegalDoc = { title: string; meta: string; sections: { h: string; body: Block[] }[] }
