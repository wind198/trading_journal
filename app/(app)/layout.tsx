import { AppProviders } from '@/app/(app)/_components/providers/app-providers'
import { QueryProvider } from '@/app/(app)/_components/providers/query-provider'
import {AnalysisSessionProvider} from './_components/providers/analysis-session-provider'
import { AppShell } from './_components/app-shell/app-shell'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <QueryProvider><AnalysisSessionProvider><AppShell>{children}</AppShell></AnalysisSessionProvider></QueryProvider>
    </AppProviders>
  )
}
