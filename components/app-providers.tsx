'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DateRangeProvider } from '@/components/date-range-provider'
import { TradesFilterProvider } from '@/components/trades-filter-provider'
import { AppShell } from '@/components/app-shell'

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState<string | undefined>()
  const [ready, setReady] = useState(false)
  const isDashboard = pathname === '/trading-dashboard'

  useEffect(() => {
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email || undefined)
      setReady(true)
    }
    void boot()
  }, [router, supabase])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <DateRangeProvider>
      <TradesFilterProvider>
        {isDashboard ? children : <AppShell userEmail={email}>{children}</AppShell>}
      </TradesFilterProvider>
    </DateRangeProvider>
  )
}
