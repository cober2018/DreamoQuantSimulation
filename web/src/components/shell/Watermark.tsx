import { useSession } from '@/lib/auth'

export function Watermark() {
  const name = useSession((s) => s.user?.username)
  if (!name) return null
  const text = `${name} · ${new Date().toISOString().slice(0, 10)}`
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 flex select-none flex-wrap overflow-hidden opacity-[0.07]" style={{ transform: 'rotate(-18deg) scale(1.4)' }}>
      {Array.from({ length: 60 }, (_, i) => <span key={i} className="w-60 whitespace-nowrap px-3 py-7 text-sm">{text}</span>)}
    </div>
  )
}
