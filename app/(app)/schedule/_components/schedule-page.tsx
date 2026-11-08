'use client'

import { useRouter } from 'next/navigation'
import { AppNavLinks } from '@/app/(app)/_components/app-nav-links'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { ScheduleTimetable } from './schedule-timetable'

export function SchedulePage() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <AppNavLinks />
          <h1 className="truncate text-sm font-semibold">Schedule</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <ScheduleTimetable />
      </main>
    </div>
  )
}
