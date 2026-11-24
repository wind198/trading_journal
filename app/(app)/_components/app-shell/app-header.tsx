'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChartCandlestick, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AppNavLinks } from '../app-nav-links'

export function AppHeader() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Unable to sign out')
    } finally {
      setPending(false)
    }
  }

  return (
    <header className="app-shell-header flex h-11 shrink-0 items-center gap-3 border-b bg-card px-2 sm:px-3">
      <a href="#app-content" className="sr-only focus:not-sr-only">Skip to content</a>
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <ChartCandlestick className="size-4" aria-hidden />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Trading Journal</span>
      </div>
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
      <AppNavLinks className="min-w-0" />
      <Button type="button" variant="ghost" size="icon-sm" className="ml-auto shrink-0" disabled={pending} onClick={() => void signOut()} aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" aria-hidden />
      </Button>
    </header>
  )
}
