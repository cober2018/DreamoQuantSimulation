// 小程序编译时通过 VITE_API_BASE 注入 HTTPS 网关地址; H5 预览为空 (走同源代理)
export const API_BASE = import.meta.env.VITE_API_BASE || ''
export const DISCLAIMER = '本平台仅提供证券信息汇总与历史数据统计，不构成任何证券投资建议。'
