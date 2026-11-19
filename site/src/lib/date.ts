// 日期按北京时间显示
const pad = (n: number) => String(n).padStart(2, '0');
const bj = (d: Date) => new Date(d.valueOf() + 8 * 3600e3);
export const formatDateZh = (d: Date) => {
  const t = bj(d);
  return `${t.getUTCFullYear()} 年 ${t.getUTCMonth() + 1} 月 ${t.getUTCDate()} 日`;
};
export const isoDate = (d: Date) => {
  const t = bj(d);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
