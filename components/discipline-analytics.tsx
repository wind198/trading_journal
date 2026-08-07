'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { DisciplineCheck } from '@/lib/types'
import { computeDailyScores } from '@/lib/discipline-analytics'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const SCORE_COLOR = '#05B169'

type DisciplineAnalyticsProps = {
  checks: DisciplineCheck[]
  dates: string[]
}

export function DisciplineAnalytics({
  checks,
  dates,
}: DisciplineAnalyticsProps) {
  const analytics = useMemo(
    () => computeDailyScores(checks, dates),
    [checks, dates]
  )

  const chartData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: analytics.daily.map((d) => d.label),
      datasets: [
        {
          label: 'Score %',
          data: analytics.daily.map((d) => d.scorePct),
          backgroundColor: SCORE_COLOR,
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    }),
    [analytics.daily]
  )

  const chartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const day = analytics.daily[ctx.dataIndex]
              if (!day) return ` ${ctx.parsed.y}%`
              return ` ${day.scorePct}% (${day.checked}/${day.total})`
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          grid: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            font: { size: 10 },
            callback: (value) => `${value}%`,
          },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    }),
    [analytics.daily]
  )

  if (dates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/50 px-6 py-10 text-center text-sm text-muted-foreground">
        No dates in this range.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-neutral">
            Avg score
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {analytics.avgScorePct}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-neutral">
            Days tracked
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {analytics.daysTracked}
            <span className="ml-1 text-[11px] font-normal text-neutral">
              / {dates.length}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
          Score by date
        </h3>
        <div className="h-44 sm:h-56">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  )
}
