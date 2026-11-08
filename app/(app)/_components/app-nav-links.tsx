'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/trading-dashboard', label: 'Dashboard' },
  { href: '/schedule', label: 'Schedule' },
] as const

export function AppNavLinks({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn('flex items-center gap-0.5', className)} aria-label="App">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-2 py-1 text-sm transition-colors',
              active
                ? 'bg-secondary font-medium text-secondary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
