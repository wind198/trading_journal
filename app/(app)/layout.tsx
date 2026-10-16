import { AppProviders } from '@/app/(app)/_components/providers/app-providers'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
