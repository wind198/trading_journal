'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { TradeEntry } from '@/lib/types'
import { computeTradeAnalytics } from '@/lib/trade-analytics'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
)

const COLORS = {
  win: '#05B169',
  loss: '#DF2935',
  pending: '#8A919E',
  buyEx: '#0052FF',
  buyTf: '#3B82F6',
  sellEx: '#F0AD4E',
  sellTf: '#F59E0B',
}

type TradeAnalyticsProps = {
  trades: TradeEntry[]
  isLoading?: boolean
}

export function TradeAnalytics({ trades, isLoading }: TradeAnalyticsProps) {
  const analytics = useMemo(() => computeTradeAnalytics(trades), [trades])

  const outcomeData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: ['Win', 'Loss', 'Pending'],
      datasets: [
        {
          data: [analytics.wins, analytics.losses, analytics.pending],
          backgroundColor: [COLORS.win, COLORS.loss, COLORS.pending],
          borderWidth: 0,
        },
      ],
    }),
    [analytics.wins, analytics.losses, analytics.pending]
  )

  const tendencyData = useMemo<ChartData<'bar'>>(() => {
    const labels = analytics.segments.map((s) => s.shortLabel)
    return {
      labels,
      datasets: [
        {
          label: 'Trades',
          data: analytics.segments.map((s) => s.total),
          backgroundColor: [
            COLORS.buyEx,
            COLORS.buyTf,
            COLORS.sellEx,
            COLORS.sellTf,
          ],
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    }
  }, [analytics.segments])

  const dailyData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: analytics.daily.map((d) => d.label),
      datasets: [
        {
          label: 'Win',
          data: analytics.daily.map((d) => d.wins),
          backgroundColor: COLORS.win,
          stack: 'outcome',
          borderRadius: 2,
        },
        {
          label: 'Loss',
          data: analytics.daily.map((d) => d.losses),
          backgroundColor: COLORS.loss,
          stack: 'outcome',
          borderRadius: 2,
        },
        {
          label: 'Pending',
          data: analytics.daily.map((d) => d.pending),
          backgroundColor: COLORS.pending,
          stack: 'outcome',
          borderRadius: 2,
        },
      ],
    }),
    [analytics.daily]
  )

  const doughnutOptions = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.raw ?? 0)
              const sum = analytics.total || 1
              const share = Math.round((value / sum) * 1000) / 10
              return ` ${ctx.label}: ${value} (${share}%)`
            },
          },
        },
      },
    }),
    [analytics.total]
  )

  const tendencyOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const seg = analytics.segments[ctx.dataIndex]
              if (!seg) return ''
              const wr =
                seg.winRatePct === null ? 'n/a' : `${seg.winRatePct}%`
              return `Share ${seg.sharePct}% · WR ${wr}`
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y: {
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
      },
    }),
    [analytics.segments]
  )

  const dailyOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            font: { size: 11 },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    }),
    []
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl sm:h-56" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    )
  }

  if (analytics.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/50 px-6 py-10 text-center text-sm text-muted-foreground">
        No trades in this range for analytics.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Trades" value={String(analytics.total)} />
        <StatCard
          label="Win rate"
          value={
            analytics.winRatePct === null ? '—' : `${analytics.winRatePct}%`
          }
          hint={`${analytics.completed} done`}
        />
        <StatCard
          label="W–L"
          value={`${analytics.wins}–${analytics.losses}`}
          valueClassName="text-foreground"
        />
        <StatCard label="Pending" value={String(analytics.pending)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChartPanel title="Outcome mix">
          <div className="relative mx-auto h-48 w-full max-w-60 sm:h-52">
            <Doughnut data={outcomeData} options={doughnutOptions} />
          </div>
        </ChartPanel>

        <ChartPanel title="Tendency">
          <div className="h-48 sm:h-52">
            <Bar data={tendencyData} options={tendencyOptions} />
          </div>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {analytics.segments.map((seg) => (
          <div
            key={seg.key}
            className="rounded-lg border border-border bg-card px-2.5 py-2"
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              {seg.shortLabel}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {seg.total}
              <span className="ml-1 text-[11px] font-normal text-neutral">
                ({seg.sharePct}%)
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              WR{' '}
              {seg.winRatePct === null ? '—' : `${seg.winRatePct}%`}
              {seg.completed > 0 && (
                <span className="text-neutral"> · {seg.completed} done</span>
              )}
            </p>
          </div>
        ))}
      </div>

      <ChartPanel title="Daily outcomes">
        <div className="h-44 sm:h-56">
          {analytics.daily.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No daily data
            </p>
          ) : (
            <Bar data={dailyData} options={dailyOptions} />
          )}
        </div>
      </ChartPanel>

      {analytics.insights.length > 0 && (
        <ul className="space-y-1.5 rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          {analytics.insights.map((line) => (
            <li key={line} className="leading-snug">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string
  value: string
  hint?: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-neutral">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight',
          valueClassName
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

function ChartPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
        {title}
      </h3>
      {children}
    </div>
  )
}
