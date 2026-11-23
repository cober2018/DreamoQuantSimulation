import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

// 带「显示 / 隐藏」切换的密码框
export function PasswordInput({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} aria-label={label} className="pr-10" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? `隐藏${label}` : `显示${label}`} aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center text-ink-3 hover:text-foreground">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
