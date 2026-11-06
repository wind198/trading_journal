'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activeNonTradePeriod } from '../../_lib/non-trade-periods'

const AUTO_HIDE_MS = 3_000
const POLL_MS = 30_000

export function NonTradeWarningBanner() {
  const [periodLabel, setPeriodLabel] = useState<string | null>(null)
  const [visible, setVisible] = useState()
  const dismissedForLabelRef = useRef<string | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current != null) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }

    const sync = () => {
      const period = activeNonTradePeriod()
      if (period == null) {
        dismissedForLabelRef.current = null
        setPeriodLabel(null)
        setVisible(false)
        clearHideTimer()
        return
      }
      setPeriodLabel(period.label)
      if (dismissedForLabelRef.current === period.label) {
        setVisible(false)
        return
      }
      setVisible((wasVisible) => {
        if (!wasVisible) {
          clearHideTimer()
          hideTimerRef.current = setTimeout(() => {
            dismissedForLabelRef.current = period.label
            setVisible(false)
            hideTimerRef.current = null
          }, AUTO_HIDE_MS)
        }
        return true
      })
    }

    sync()
    const id = setInterval(sync, POLL_MS)
    return () => {
      clearInterval(id)
      clearHideTimer()
    }
  }, [])

  if (!visible || periodLabel == null) return null

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-sm text-amber-950 dark:text-amber-100"
    >
      <p className="min-w-0 flex-1">
        Non-trade period ({periodLabel}). Avoid new entries.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100"
        aria-label="Dismiss non-trade warning"
        onClick={() => {
          dismissedForLabelRef.current = periodLabel
          setVisible(false)
        }}
      >
        <X />
      </Button>
    </div>
  )
}
