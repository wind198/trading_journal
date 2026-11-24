'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartCandlestick, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/trading-dashboard', label: 'Workspace', icon: ChartCandlestick },
  { href: '/calculator', label: 'Calculator', icon: Calculator },
] as const

export function AppNavLinks({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="Application">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} title={label}
            className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="size-4" aria-hidden />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
