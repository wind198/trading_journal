'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { DISCIPLINE_ITEMS, type DisciplineItemKey } from '@/lib/discipline'
import { eachDateInclusive, formatVnDate, todayVn } from '@/lib/date-range'
import { useDateRange } from '@/components/date-range-provider'
import { DisciplineAnalytics } from '@/components/discipline-analytics'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { DisciplineCheck } from '@/lib/types'
import { cn } from '@/lib/utils'

const SAVE_DEBOUNCE_MS = 2000

type CheckMap = Record<string, Record<string, DisciplineCheck | undefined>>

type DayWithItems = {
  id: string
  check_date: string
  discipline_check_items: {
    id: string
    item_key: DisciplineItemKey
    checked: boolean
    updated_at: string
  }[]
}

type PendingSave = {
  itemKey: DisciplineItemKey
  date: string
  checked: boolean
  existingId?: string
  serverChecked: boolean
}

function cellKey(itemKey: DisciplineItemKey, date: string) {
  return `${itemKey}|${date}`
}

export function DisciplineScreen() {
  const { range } = useDateRange()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [checks, setChecks] = useState<DisciplineCheck[]>([])
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [savingKeys, setSavingKeys] = useState<Record<string, true>>({})
  const [isLoading, setIsLoading] = useState(true)

  const userIdRef = useRef<string | null>(null)
  const checksRef = useRef<DisciplineCheck[]>([])
  const overridesRef = useRef<Record<string, boolean>>({})
  const pendingSavesRef = useRef<Map<string, PendingSave>>(new Map())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const persistOneRef = useRef<(key: string) => Promise<void>>(async () => {})

  userIdRef.current = userId
  checksRef.current = checks
  overridesRef.current = overrides

  const dates = useMemo(
    () => eachDateInclusive(range.from, range.to),
    [range.from, range.to]
  )

  const checkMap = useMemo(() => {
    const map: CheckMap = {}
    for (const item of DISCIPLINE_ITEMS) {
      map[item.key] = {}
    }
    for (const row of checks) {
      if (!map[row.item_key]) map[row.item_key] = {}
      map[row.item_key][row.check_date] = row
    }
    return map
  }, [checks])

  const effectiveChecks = useMemo(() => {
    const result = checks.map((row) => {
      const key = cellKey(row.item_key, row.check_date)
      if (key in overrides) return { ...row, checked: overrides[key] }
      return row
    })
    const seen = new Set(
      result.map((row) => cellKey(row.item_key, row.check_date))
    )
    for (const [key, checked] of Object.entries(overrides)) {
      if (!checked || seen.has(key)) continue
      const [itemKey, date] = key.split('|') as [DisciplineItemKey, string]
      result.push({
        id: `local-${key}`,
        day_id: '',
        check_date: date,
        item_key: itemKey,
        checked: true,
        updated_at: new Date().toISOString(),
      })
    }
    return result
  }, [checks, overrides])

  const ensureToday = useCallback(
    async (uid: string) => {
      const today = todayVn()

      const { data: existingDay, error: findError } = await supabase
        .from('discipline_days')
        .select('id')
        .eq('user_id', uid)
        .eq('check_date', today)
        .maybeSingle()

      if (findError) throw findError

      let dayId = existingDay?.id as string | undefined

      if (!dayId) {
        const { data: created, error: createError } = await supabase
          .from('discipline_days')
          .insert([{ user_id: uid, check_date: today }])
          .select('id')
          .single()

        if (createError) {
          const { data: raced, error: raceError } = await supabase
            .from('discipline_days')
            .select('id')
            .eq('user_id', uid)
            .eq('check_date', today)
            .single()
          if (raceError) throw createError
          dayId = raced.id
        } else {
          dayId = created.id
        }
      }

      const items = DISCIPLINE_ITEMS.map((item) => ({
        day_id: dayId!,
        item_key: item.key,
        checked: false,
      }))

      const { error: itemsError } = await supabase
        .from('discipline_check_items')
        .upsert(items, {
          onConflict: 'day_id,item_key',
          ignoreDuplicates: true,
        })

      if (itemsError) throw itemsError
    },
    [supabase]
  )

  const loadChecks = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from('discipline_days')
        .select(
          'id, check_date, discipline_check_items(id, item_key, checked, updated_at)'
        )
        .eq('user_id', uid)
        .gte('check_date', range.from)
        .lte('check_date', range.to)
        .order('check_date', { ascending: true })

      if (error) throw error

      const flat: DisciplineCheck[] = []
      for (const day of (data as DayWithItems[]) || []) {
        for (const item of day.discipline_check_items || []) {
          flat.push({
            id: item.id,
            day_id: day.id,
            check_date: day.check_date,
            item_key: item.item_key,
            checked: item.checked,
            updated_at: item.updated_at,
          })
        }
      }
      setChecks(flat)
    },
    [range.from, range.to, supabase]
  )

  const clearOverride = useCallback((key: string) => {
    setOverrides((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      overridesRef.current = next
      return next
    })
  }, [])

  const persistOne = useCallback(
    async (key: string) => {
      const save = pendingSavesRef.current.get(key)
      if (!save) return

      const uid = userIdRef.current
      if (!uid) return

      const timer = timersRef.current.get(key)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(key)
      }

      const unchanged =
        save.checked === save.serverChecked &&
        (Boolean(save.existingId) || !save.checked)
      if (unchanged) {
        pendingSavesRef.current.delete(key)
        clearOverride(key)
        return
      }

      if (!save.existingId && !save.checked) {
        pendingSavesRef.current.delete(key)
        clearOverride(key)
        return
      }

      pendingSavesRef.current.delete(key)
      setSavingKeys((prev) => ({ ...prev, [key]: true }))

      try {
        if (save.existingId) {
          const { error } = await supabase
            .from('discipline_check_items')
            .update({
              checked: save.checked,
              updated_at: new Date().toISOString(),
            })
            .eq('id', save.existingId)
          if (error) throw error

          setChecks((prev) =>
            prev.map((row) =>
              row.id === save.existingId
                ? { ...row, checked: save.checked }
                : row
            )
          )
        } else {
          let dayId: string | undefined

          const { data: day, error: dayFindError } = await supabase
            .from('discipline_days')
            .select('id')
            .eq('user_id', uid)
            .eq('check_date', save.date)
            .maybeSingle()

          if (dayFindError) throw dayFindError
          dayId = day?.id

          if (!dayId) {
            const { data: created, error: createError } = await supabase
              .from('discipline_days')
              .insert([{ user_id: uid, check_date: save.date }])
              .select('id')
              .single()
            if (createError) throw createError
            dayId = created.id
          }

          const { data: inserted, error } = await supabase
            .from('discipline_check_items')
            .insert([
              {
                day_id: dayId,
                item_key: save.itemKey,
                checked: save.checked,
              },
            ])
            .select('id, updated_at')
            .single()

          if (error) throw error

          setChecks((prev) => {
            const without = prev.filter(
              (row) =>
                !(
                  row.item_key === save.itemKey &&
                  row.check_date === save.date
                )
            )
            return [
              ...without,
              {
                id: inserted.id,
                day_id: dayId!,
                check_date: save.date,
                item_key: save.itemKey,
                checked: save.checked,
                updated_at: inserted.updated_at,
              },
            ]
          })
        }

        clearOverride(key)
      } catch (error) {
        console.error('[discipline] save error:', error)
        toast.error('Could not update checklist')
        clearOverride(key)
      } finally {
        setSavingKeys((prev) => {
          if (!(key in prev)) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    },
    [clearOverride, supabase]
  )

  persistOneRef.current = persistOne

  const flushAllPending = useCallback(async () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
    const keys = [...pendingSavesRef.current.keys()]
    await Promise.all(keys.map((key) => persistOneRef.current(key)))
  }, [])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      setIsLoading(true)
      try {
        await flushAllPending()
        if (cancelled) return

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) return
        setUserId(user.id)
        await ensureToday(user.id)
        if (cancelled) return
        await loadChecks(user.id)
        if (!cancelled) {
          setOverrides({})
        }
      } catch (error) {
        console.error('[discipline] load error:', error)
        toast.error('Failed to load discipline checklist')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void boot()

    return () => {
      cancelled = true
    }
  }, [ensureToday, flushAllPending, loadChecks, supabase])

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
      const keys = [...pendingSavesRef.current.keys()]
      void Promise.all(keys.map((key) => persistOneRef.current(key)))
    }
  }, [])

  const toggle = (itemKey: DisciplineItemKey, date: string) => {
    if (!userId) return
    const key = cellKey(itemKey, date)
    if (savingKeys[key]) return

    const existing = checksRef.current.find(
      (row) => row.item_key === itemKey && row.check_date === date
    )
    const serverChecked = existing?.checked ?? false
    const current =
      key in overridesRef.current
        ? overridesRef.current[key]
        : serverChecked
    const nextChecked = !current

    overridesRef.current = { ...overridesRef.current, [key]: nextChecked }
    setOverrides(overridesRef.current)

    pendingSavesRef.current.set(key, {
      itemKey,
      date,
      checked: nextChecked,
      existingId: existing?.id,
      serverChecked,
    })

    const prevTimer = timersRef.current.get(key)
    if (prevTimer) clearTimeout(prevTimer)

    const timer = setTimeout(() => {
      timersRef.current.delete(key)
      void persistOne(key)
    }, SAVE_DEBOUNCE_MS)
    timersRef.current.set(key, timer)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.06em] text-neutral">
          Daily discipline
        </h2>

        <div className="overflow-x-auto rounded-xl border border-border bg-card -mx-1 px-1">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 max-w-28 w-28 bg-muted/40 px-2 py-2.5 text-left text-xs font-medium uppercase tracking-[0.06em] text-neutral sm:max-w-45 sm:w-45 sm:px-3">
                  Item
                </th>
                {dates.map((date) => (
                  <th
                    key={date}
                    className="min-w-12 px-1.5 py-2.5 text-center text-xs font-medium text-muted-foreground sm:min-w-14 sm:px-2"
                  >
                    {formatVnDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISCIPLINE_ITEMS.map((item) => (
                <tr key={item.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 max-w-28 w-28 bg-card px-2 py-2.5 text-left text-xs font-medium leading-snug text-foreground sm:max-w-45 sm:w-45 sm:px-3 sm:text-sm">
                    <span className="line-clamp-3 sm:line-clamp-none">{item.label}</span>
                  </td>
                  {dates.map((date) => {
                    const key = cellKey(item.key, date)
                    const row = checkMap[item.key]?.[date]
                    const checked =
                      key in overrides ? overrides[key] : (row?.checked ?? false)
                    const busy = Boolean(savingKeys[key])
                    return (
                      <td key={date} className="min-w-12 px-1 py-2 text-center sm:min-w-14 sm:px-2">
                        <div className="flex min-h-11 items-center justify-center">
                          <Checkbox
                            checked={checked}
                            disabled={busy}
                            onCheckedChange={() => toggle(item.key, date)}
                            aria-label={`${item.label} ${date}`}
                            className={cn(
                              'size-6 border-2 border-foreground/40',
                              checked &&
                                'border-success bg-success text-white data-checked:border-success data-checked:bg-success'
                            )}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-medium uppercase tracking-[0.06em] text-neutral">
          Analytics
        </h2>
        <DisciplineAnalytics checks={effectiveChecks} dates={dates} />
      </section>
    </div>
  )
}
