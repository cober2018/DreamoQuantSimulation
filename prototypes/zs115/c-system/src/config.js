/* global __BRIEF_LIVE__, __SOCIAL_DRAFTS__ */
// 全站开关只在这里读一次，页面一律从本文件取值。构建时用环境变量设定：BRIEF_LIVE=true npm run build
import { landingCopy } from './copy.js'

// 「每日要点」是否已上线（ZS-112 R2）。false：介绍页写「即将推出」，要点卡片只作为样张
export const BRIEF_LIVE = __BRIEF_LIVE__
export const COPY = landingCopy(BRIEF_LIVE)

// 自媒体卡片里 ready=false 的占位卡是否显示。生产构建默认不显示；
// 原型预览可用 SOCIAL_DRAFTS=true 构建，或在地址后加 ?drafts=1（正式站迁到 Astro 时只保留构建期开关）
const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search)
export const SOCIAL_DRAFTS = __SOCIAL_DRAFTS__ || q?.get('drafts') === '1'
