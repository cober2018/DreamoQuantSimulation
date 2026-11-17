// 单一来源：tokens.css / tokens.json 由 scripts/gen-tokens.mjs 生成，ECharts 主题也从这里取色，避免三处各写一份
export const color = {
  light: {
    bg: '#F3F4F6', surface: '#FFFFFF', surface2: '#F8F9FA', sunken: '#ECEEF1',
    line: '#E1E4E9', lineStrong: '#C6CBD3', grid: 'rgba(17,24,39,0.055)',
    ink: '#0F131A', ink2: '#353C48', muted: '#5B6472', faint: '#8B93A0',
    accent: '#1D4ED8', accentHover: '#1A43BC', accentInk: '#FFFFFF', accentSoft: 'rgba(29,78,216,0.08)', accentLine: 'rgba(29,78,216,0.35)',
    up: '#B4383A', upSoft: 'rgba(180,56,58,0.10)', down: '#1C7550', downSoft: 'rgba(28,117,80,0.10)',
    warn: '#9A5B00', warnSoft: 'rgba(154,91,0,0.10)', focus: '#1D4ED8',
  },
  dark: {
    bg: '#0A0C10', surface: '#101318', surface2: '#151920', sunken: '#07090C',
    line: '#222731', lineStrong: '#353C49', grid: 'rgba(190,205,240,0.05)',
    ink: '#E7EAF0', ink2: '#B9C0CC', muted: '#8E97A5', faint: '#5F6775',
    accent: '#6B93FF', accentHover: '#86A7FF', accentInk: '#0A0C10', accentSoft: 'rgba(107,147,255,0.12)', accentLine: 'rgba(107,147,255,0.45)',
    up: '#E2716C', upSoft: 'rgba(226,113,108,0.13)', down: '#45B485', downSoft: 'rgba(69,180,133,0.13)',
    warn: '#D9A04A', warnSoft: 'rgba(217,160,74,0.13)', focus: '#86A7FF',
  },
}

export const font = {
  sans: '"Inter", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
  display: '"ZS Display", "Inter", "PingFang SC", "Microsoft YaHei", sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
}

// 字号阶梯（px / 行高）：数据平台主用 12–16，展示字号只给页标题和营销页
export const type = {
  '2xs': [11, 16], xs: [12, 18], sm: [13, 20], md: [14, 22], base: [16, 26],
  lg: [20, 28], xl: [28, 34], '2xl': [40, 44], '3xl': [56, 60], '4xl': [76, 80],
}

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96 }
export const radius = { xs: 2, sm: 4, md: 6, lg: 10, pill: 999 }

export const shadow = {
  light: { 1: '0 1px 0 rgba(15,19,26,0.04)', 2: '0 1px 2px rgba(15,19,26,0.06), 0 8px 24px -12px rgba(15,19,26,0.18)', pop: '0 16px 40px -16px rgba(15,19,26,0.28)' },
  dark: { 1: '0 1px 0 rgba(0,0,0,0.4)', 2: '0 0 0 1px rgba(255,255,255,0.02), 0 12px 32px -16px rgba(0,0,0,0.7)', pop: '0 20px 48px -20px rgba(0,0,0,0.85)' },
}

export const motion = { fast: 150, base: 200, slow: 250, tick: 640, draw: 900, ease: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }

export const grid = { columns: 12, gutter: { sm: 16, md: 20, lg: 24 }, margin: { sm: 16, md: 24, lg: 32 }, maxWidth: 1680 }
