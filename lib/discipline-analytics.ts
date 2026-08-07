import { DISCIPLINE_ITEMS } from '@/lib/discipline'
import { formatVnDate } from '@/lib/date-range'
import { DisciplineCheck } from '@/lib/types'

export type DailyDisciplineScore = {
  dateKey: string
  label: string
  checked: number
  total: number
  scorePct: number
}

export type DisciplineAnalyticsResult = {
  daily: DailyDisciplineScore[]
  avgScorePct: number
  daysTracked: number
}

const ITEM_COUNT = DISCIPLINE_ITEMS.length

export function computeDailyScores(
  checks: DisciplineCheck[],
  dates: string[]
): DisciplineAnalyticsResult {
  const checkedByDate = new Map<string, number>()

  for (const row of checks) {
    if (!row.checked) continue
    checkedByDate.set(
      row.check_date,
      (checkedByDate.get(row.check_date) ?? 0) + 1
    )
  }

  const daily: DailyDisciplineScore[] = dates.map((dateKey) => {
    const checked = Math.min(checkedByDate.get(dateKey) ?? 0, ITEM_COUNT)
    const scorePct =
      ITEM_COUNT > 0
        ? Math.round((checked / ITEM_COUNT) * 1000) / 10
        : 0
    return {
      dateKey,
      label: formatVnDate(dateKey),
      checked,
      total: ITEM_COUNT,
      scorePct,
    }
  })

  const avgScorePct =
    daily.length === 0
      ? 0
      : Math.round(
          (daily.reduce((sum, d) => sum + d.scorePct, 0) / daily.length) * 10
        ) / 10

  const daysTracked = daily.filter((d) => d.checked > 0).length

  return { daily, avgScorePct, daysTracked }
}
