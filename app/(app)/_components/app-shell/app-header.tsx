'use client'

import { usePathname } from 'next/navigation'
import { ChartCandlestick } from 'lucide-react'
import { AppMenu } from './app-menu'
import { AppNavLinks } from '../app-nav-links'

export function AppHeader() {
  const pathname = usePathname()
  const workspace = pathname === '/trading-dashboard' || pathname.startsWith('/trading-dashboard/')
  
  return (
    <header data-workspace-route={workspace ? "true" : undefined} className="app-shell-header flex h-11 shrink-0 items-center gap-3 border-b bg-card px-2 sm:px-3">
      <a href="#app-content" className="sr-only focus:not-sr-only">Skip to content</a>
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <ChartCandlestick className="size-4" aria-hidden />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Trading Journal</span>
      </div>
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
      <AppNavLinks className="min-w-0" />
      <div className="ml-auto"><AppMenu /></div>
    </header>
  )
}
