// 公开站的全站常量。astro.config.mjs 和页面都从这里取，改一处即全站生效。
export const SITE = {
  origin: 'https://dk.dreamotech.cn',
  name: '知数星耀',
  brand: 'DreamOTech',
  icp: '浙ICP备2024135110号',
  description: '知数星耀：A 股盘后数据。指数与涨跌家数、成交与参与度、行业板块、涨停题材、事件日程，按交易日更新，每个数字标明数据日期与口径。只给数据，不构成投资建议。',
  disclaimer: '本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。',
};

// MCP 服务地址：正式上线前统一是占位符，上线时只改这一行（ZS-115 §三）。
// 文档正文里写 %MCP_URL%，构建时由 src/middleware.ts 在输出的 HTML 里替换。
export const MCP_URL = '<上线后公布>';

// 这些路径由平台 SPA 提供（部署时与静态站合并到同一站点），静态站只链接过去。
// 隐私政策目前是 /terms 页里的一节；独立隐私页（ZS-107）上线后改这里。
export const APP_LINKS = { login: '/login', terms: '/terms', privacy: '/terms' };
