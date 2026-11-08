'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { minutesOfDayInChartZone } from '@/app/(app)/trading-dashboard/_lib/chart/chart-timezone'
import { cn } from '@/lib/utils'
import {
  DAILY_SCHEDULE,
  SCHEDULE_DAY_END_MIN,
  SCHEDULE_DAY_START_MIN,
  formatScheduleClock,
  formatScheduleRange,
  type ScheduleBlock,
  type ScheduleMode,
} from '../_lib/daily-schedule'

/** Proportional scale; short blocks still get MIN_BLOCK_PX so content stays readable. */
const PX_PER_MIN = 2.4
const MIN_BLOCK_PX = 72

const MODE_STYLES: Record<
  ScheduleMode,
  { rail: string; badge: string; label: string }
> = {
  PREP: {
    rail: 'bg-secondary',
    badge: 'bg-secondary text-secondary-foreground',
    label: 'PREP',
  },
  TRADE: {
    rail: 'bg-emerald-500/80',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    label: 'TRADE',
  },
  NO_TRADE: {
    rail: 'bg-muted-foreground/40',
    badge: 'bg-muted text-muted-foreground',
    label: 'NO TRADE',
  },
  MANAGE: {
    rail: 'bg-amber-500/80',
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
    label: 'MANAGE',
  },
  JOURNAL: {
    rail: 'bg-primary/70',
    badge: 'bg-primary/10 text-primary',
    label: 'JOURNAL',
  },
}

const LEGEND: ScheduleMode[] = ['PREP', 'TRADE', 'NO_TRADE', 'MANAGE', 'JOURNAL']

function blockHeightPx(block: ScheduleBlock): number {
  return Math.max((block.endMin - block.startMin) * PX_PER_MIN, MIN_BLOCK_PX)
}

type LaidOutBlock = ScheduleBlock & { top: number; height: number }

function layoutBlocks(blocks: readonly ScheduleBlock[]): {
  rows: LaidOutBlock[]
  totalHeight: number
} {
  let top = 0
  const rows = blocks.map((block) => {
    const height = blockHeightPx(block)
    const row = { ...block, top, height }
    top += height
    return row
  })
  return { rows, totalHeight: top }
}

/** Map clock minutes → Y within the clamped layout (for the now line). */
function minutesToY(minutes: number, rows: LaidOutBlock[]): number {
  if (rows.length === 0) return 0
  if (minutes <= rows[0].startMin) return rows[0].top
  for (const row of rows) {
    if (minutes < row.endMin) {
      if (minutes <= row.startMin) return row.top
      const frac = (minutes - row.startMin) / (row.endMin - row.startMin)
      return row.top + frac * row.height
    }
  }
  const last = rows[rows.length - 1]
  return last.top + last.height
}

export function ScheduleTimetable() {
  const nowLineRef = useRef<HTMLDivElement>(null)
  const [nowMin, setNowMin] = useState(() => minutesOfDayInChartZone())
  const { rows, totalHeight } = useMemo(() => layoutBlocks(DAILY_SCHEDULE), [])

  useEffect(() => {
    const tick = () => setNowMin(minutesOfDayInChartZone())
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  const inDay = nowMin >= SCHEDULE_DAY_START_MIN && nowMin <= SCHEDULE_DAY_END_MIN
  const nowTop = minutesToY(nowMin, rows)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {LEGEND.map((mode) => {
          const s = MODE_STYLES[mode]
          return (
            <span
              key={mode}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5', s.badge)}
            >
              <span className={cn('h-2 w-2 rounded-sm', s.rail)} aria-hidden />
              {s.label}
            </span>
          )
        })}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card">
        <div className="relative" style={{ height: totalHeight }}>
          {rows.map((block) => {
            const s = MODE_STYLES[block.mode]
            return (
              <div
                key={`${block.startMin}-${block.endMin}`}
                className="absolute inset-x-0 flex border-b border-border/60"
                style={{ top: block.top, height: block.height, minHeight: MIN_BLOCK_PX }}
              >
                <div className={cn('w-1.5 shrink-0', s.rail)} aria-hidden />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatScheduleRange(block.startMin, block.endMin)}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        s.badge,
                      )}
                    >
                      {block.modeLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {block.life}
                      {block.market !== '—' ? ` · ${block.market}` : ''}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm leading-snug text-foreground/90">
                    {block.actions}
                  </p>
                </div>
              </div>
            )
          })}

          {inDay ? (
            <div
              ref={nowLineRef}
              className="pointer-events-none absolute inset-x-0 z-10"
              style={{ top: nowTop }}
              aria-label={`Now ${formatScheduleClock(nowMin)}`}
            >
              <div className="relative -translate-y-1/2">
                <div className="h-px w-full bg-red-500" />
                <span className="absolute -top-2.5 left-3 rounded bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white tabular-nums">
                  {formatScheduleClock(nowMin)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
