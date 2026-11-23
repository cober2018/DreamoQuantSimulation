import type { ComponentType } from 'react'
import { Activity, CalendarDays, Flame, History, Layers, LayoutDashboard } from 'lucide-react'

export const PAGE_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  overview: LayoutDashboard, participation: Activity, industries: Layers, themes: Flame, history: History, calendar: CalendarDays,
}
