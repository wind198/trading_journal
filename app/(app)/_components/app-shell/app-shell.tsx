import type { ReactNode } from 'react'
import { AppHeader } from './app-header'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <AppHeader />
      <main id="app-content" className="relative min-h-0 min-w-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
