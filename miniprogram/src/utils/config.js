// 小程序编译时通过 VITE_API_BASE 注入 HTTPS 网关地址; H5 预览为空 (走同源代理)
export const API_BASE = import.meta.env.VITE_API_BASE || ''
export const DISCLAIMER = '本平台提供市场数据与历史统计，仅供研究和学习参考，不构成任何投资建议、证券推荐或交易指令。数据可能存在延迟、缺失或误差，请以交易所及上市公司的官方披露为准。投资有风险，决策请独立判断。'
