import data from '../data/social.json';
// ready=false 的卡片默认不构建；本地预览占位卡用 SOCIAL_DRAFTS=1
export const SOCIAL = data.items.filter((s) => s.ready || process.env.SOCIAL_DRAFTS === '1');
