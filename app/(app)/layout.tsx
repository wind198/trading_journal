import { AppProviders } from '@/components/app-providers'
import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>
}
