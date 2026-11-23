import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'
import { useDialogs, useSecret } from '@/lib/dialogs'

function PromptForm() {
  const req = useDialogs((s) => s.req)
  const set = useDialogs((s) => s.set)
  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => { setVals({}) }, [req])
  if (!req || req.kind !== 'prompt') return null
  const { opts, resolve } = req
  const done = (v: Record<string, string> | null) => { resolve(v); set(null) }
  const ok = opts.fields.every((f) => !f.required || (vals[f.key] || '').trim())
  return (
    <Dialog open onOpenChange={(o) => { if (!o) done(null) }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); if (ok) done(vals) }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{opts.title}</DialogTitle>
            {opts.body && <DialogDescription>{opts.body}</DialogDescription>}
          </DialogHeader>
          {opts.fields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`pf-${f.key}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <Input id={`pf-${f.key}`} type={f.type === 'number' ? 'number' : 'text'} step={f.type === 'number' ? 'any' : undefined} placeholder={f.placeholder} value={vals[f.key] || ''} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => done(null)}>取消</Button>
            <Button type="submit" disabled={!ok}>{opts.confirmText || '确定'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmBox() {
  const req = useDialogs((s) => s.req)
  const set = useDialogs((s) => s.set)
  if (!req || req.kind !== 'confirm') return null
  const { opts, resolve } = req
  const done = (v: boolean) => { resolve(v); set(null) }
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) done(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title}</AlertDialogTitle>
          {opts.body && <AlertDialogDescription className="whitespace-pre-line">{opts.body}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction className={opts.danger ? 'bg-destructive text-white hover:bg-destructive/90' : undefined} onClick={() => done(true)}>{opts.confirmText || '确定'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SecretBox() {
  const opts = useSecret((s) => s.opts)
  const set = useSecret((s) => s.set)
  const [copied, setCopied] = useState(false)
  useEffect(() => { setCopied(false) }, [opts])
  if (!opts) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(opts.secret); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { toast.error('复制失败，请手动选中复制') }
  }
  // 点遮罩、按 Esc、点右上角 × 都不关闭：必须点「我已保存」
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{opts.title}</DialogTitle>
          <DialogDescription>{opts.note}</DialogDescription>
        </DialogHeader>
        <pre aria-label="明文内容" className="tnum max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-secondary px-3 py-2.5 font-mono text-sm select-all">{opts.secret}</pre>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={copy}>{copied ? '已复制' : '复制'}</Button>
          <Button type="button" onClick={() => set(null)}>我已保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 挂在 AppShell 里一次：确认框、输入框、只显示一次的明文框、右下角提示
export function DialogHost() {
  return <><PromptForm /><ConfirmBox /><SecretBox /><Toaster /></>
}
