import { DISCLAIMER } from './PageFrame'

export function Disclaimer({ text = DISCLAIMER }: { text?: string }) {
  return <footer className="mt-8 text-xs leading-relaxed text-ink-3">{text}</footer>
}
