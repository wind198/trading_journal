'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSwipeable } from 'react-swipeable'
import { DateRangePicker } from '@/components/date-range-picker'
import { TradesFilterControl } from '@/components/trades-filter-control'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LogOut, MoreVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReactNode } from 'react'

const TABS = [
  { href: '/journal', label: 'Trades' },
  { href: '/discipline', label: 'Discipline' },
  { href: '/quotes', label: 'Quotes' },
] as const

const TAB_ORDER = TABS.map((t) => t.href)

export function AppShell({
  children,
  userEmail,
}: {
  children: ReactNode
  userEmail?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const showDateToolbar =
    pathname === '/journal' || pathname === '/discipline'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const idx = TAB_ORDER.indexOf(pathname as (typeof TAB_ORDER)[number])
      if (idx >= 0 && idx < TAB_ORDER.length - 1) {
        router.push(TAB_ORDER[idx + 1])
      }
    },
    onSwipedRight: () => {
      const idx = TAB_ORDER.indexOf(pathname as (typeof TAB_ORDER)[number])
      if (idx > 0) {
        router.push(TAB_ORDER[idx - 1])
      }
    },
    trackTouch: true,
    trackMouse: false,
    delta: 60,
    preventScrollOnSwipe: false,
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <span className="sm:hidden">Journal</span>
              <span className="hidden sm:inline">Trading Journal</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">EURUSD · discipline</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {userEmail && (
                <>
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => void handleLogout()}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showDateToolbar && (
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            {pathname === '/journal' && <TradesFilterControl />}
          </div>
        )}

        <nav className="flex border-b border-border" aria-label="Primary">
          {TABS.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex-1 border-b-2 px-3 py-3 text-center text-[15px] font-medium transition',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div {...swipeHandlers} className="min-h-[50vh] touch-pan-y">
          {children}
        </div>
      </div>
    </div>
  )
}
