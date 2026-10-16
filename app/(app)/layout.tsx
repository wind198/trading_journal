import { AppProviders } from '@/app/(app)/_components/providers/app-providers'
import { QueryProvider } from '@/app/(app)/_components/providers/query-provider'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <QueryProvider>{children}</QueryProvider>
    </AppProviders>
  )
}
