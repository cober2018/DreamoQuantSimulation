import { create } from 'zustand'

// 替代 window.confirm / window.prompt：返回 Promise，宿主组件在 components/shell/DialogHost.tsx
export interface ConfirmOpts { title: string; body?: string; confirmText?: string; danger?: boolean }
export interface PromptField { key: string; label: string; placeholder?: string; required?: boolean; type?: 'text' | 'number' }
export interface PromptOpts { title: string; body?: string; fields: PromptField[]; confirmText?: string }

type Req =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: Record<string, string> | null) => void }

export const useDialogs = create<{ req: Req | null; set: (r: Req | null) => void }>((set) => ({ req: null, set: (req) => set({ req }) }))

export const confirmDialog = (opts: ConfirmOpts) => new Promise<boolean>((resolve) => useDialogs.getState().set({ kind: 'confirm', opts, resolve }))
export const promptDialog = (opts: PromptOpts) => new Promise<Record<string, string> | null>((resolve) => useDialogs.getState().set({ kind: 'prompt', opts, resolve }))

// 「只显示一次」的明文（临时密码、邀请码）。点遮罩、按 Esc 都不关，只能点「我已保存」
export interface SecretOpts { title: string; note: string; secret: string }
export const useSecret = create<{ opts: SecretOpts | null; set: (o: SecretOpts | null) => void }>((set) => ({ opts: null, set: (opts) => set({ opts }) }))
export const showSecret = (opts: SecretOpts) => useSecret.getState().set(opts)
