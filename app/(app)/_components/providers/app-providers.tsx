'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppLoadingScreen } from '@/app/(app)/_components/app-loading-screen'
import { shouldBypassClientAuthOnLocalhost } from '@/lib/auth/local-dev-bypass'

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const bypassAuth = shouldBypassClientAuthOnLocalhost()
  const [ready, setReady] = useState(bypassAuth)

  useEffect(() => {
    if (bypassAuth) return
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setReady(true)
    }
    void boot()
  }, [bypassAuth, router, supabase])

  if (!ready) {
    return <AppLoadingScreen />
  }

  return children
}