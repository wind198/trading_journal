'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DateRange, DateRangePreset } from '@/lib/types'
import {
  rangeThisMonth,
  rangeThisWeek,
  rangeToday,
} from '@/lib/date-range'

type DateRangeContextValue = {
  range: DateRange
  setPreset: (preset: Exclude<DateRangePreset, 'custom'>) => void
  setCustomRange: (from: string, to: string) => void
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(() => rangeToday())

  const setPreset = useCallback((preset: Exclude<DateRangePreset, 'custom'>) => {
    if (preset === 'today') setRange(rangeToday())
    else if (preset === 'week') setRange(rangeThisWeek())
    else setRange(rangeThisMonth())
  }, [])

  const setCustomRange = useCallback((from: string, to: string) => {
    const [a, b] = from <= to ? [from, to] : [to, from]
    setRange({ from: a, to: b, preset: 'custom' })
  }, [])

  const value = useMemo(
    () => ({ range, setPreset, setCustomRange }),
    [range, setPreset, setCustomRange]
  )

  return (
    <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
