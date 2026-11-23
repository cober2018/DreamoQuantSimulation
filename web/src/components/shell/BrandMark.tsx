// 品牌标记的矢量重绘：柱体随主题取墨色，弧线与节点线保持品牌金。只用标记，不用含旧名称的横版图。
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="var(--c-star)">
        <rect x="15" y="38" width="7" height="12" rx="1" />
        <rect x="25" y="32" width="7" height="18" rx="1" />
        <rect x="35" y="26" width="7" height="24" rx="1" />
        <rect x="45" y="20" width="7" height="30" rx="1" />
      </g>
      <path d="M8 40 C 6 56, 40 62, 58 46" fill="none" stroke="var(--c-accent)" strokeWidth="3" strokeLinecap="round" />
      <polyline points="10,30 24,22 38,18 52,8" fill="none" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="24" cy="22" r="2.6" fill="var(--c-bg)" stroke="var(--c-accent)" strokeWidth="1.8" />
      <circle cx="38" cy="18" r="2.6" fill="var(--c-bg)" stroke="var(--c-accent)" strokeWidth="1.8" />
      <circle cx="52" cy="8" r="3.6" fill="var(--c-accent)" stroke="var(--c-accent)" strokeWidth="1.8" />
    </svg>
  )
}
