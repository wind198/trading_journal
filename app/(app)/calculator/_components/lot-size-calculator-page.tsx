'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator } from 'lucide-react'
import { AppNavLinks } from '@/app/(app)/_components/app-nav-links'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { calculateEurusdLotSize } from '../_lib/eurusd-lot-size'
import {
  readEurusdCalculatorInputs,
  writeEurusdCalculatorInputs,
} from '../_lib/eurusd-calculator-storage'
import styles from './lot-size-calculator-page.module.css'

function parsePositiveNumber(value: string): number {
  if (value.trim() === '') return Number.NaN
  return Number(value)
}

export function LotSizeCalculatorPage() {
  const router = useRouter()
  const [riskUsd, setRiskUsd] = useState('')
  const [stopLossPoints, setStopLossPoints] = useState('')
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    const saved = readEurusdCalculatorInputs(window.localStorage)
    if (saved.riskUsd) setRiskUsd(saved.riskUsd)
    if (saved.stopLossPoints) setStopLossPoints(saved.stopLossPoints)
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    writeEurusdCalculatorInputs(window.localStorage, { riskUsd, stopLossPoints })
  }, [riskUsd, stopLossPoints, storageReady])

  const result = useMemo(
    () => calculateEurusdLotSize(
      parsePositiveNumber(riskUsd),
      parsePositiveNumber(stopLossPoints),
    ),
    [riskUsd, stopLossPoints],
  )

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <AppNavLinks />
          <h1 className="truncate text-sm font-semibold">Lot size calculator</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <main className={`flex flex-1 items-start justify-center px-4 py-8 sm:py-12 ${styles.main}`}>
        <Card className={`w-full max-w-xl ${styles.card}`}>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle>EURUSD position size</CardTitle>
                <CardDescription>
                  Calculate lot size from your maximum USD risk and stop loss.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className={`grid gap-6 ${styles.content}`}>
            <div className={styles.leftColumn}>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Instrument
                </div>
                <div className="mt-1 text-lg font-semibold">EURUSD</div>
                <div className="text-xs text-muted-foreground">
                  1.00 lot = $1 risk per point
                </div>
              </div>

              <div className={`grid gap-4 sm:grid-cols-2 ${styles.inputs}`}>
                <div className="grid gap-2">
                  <Label htmlFor="risk-usd">Risk in USD</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="risk-usd"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={riskUsd}
                      onChange={(event) => setRiskUsd(event.target.value)}
                      placeholder="40"
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="stop-loss-points">Stop loss in points</Label>
                  <Input
                    id="stop-loss-points"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={stopLossPoints}
                    onChange={(event) => setStopLossPoints(event.target.value)}
                    placeholder="60"
                  />
                </div>
              </div>
            </div>

            <div className={styles.rightColumn}>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center" aria-live="polite">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lot size
                </div>
                <div className="mt-1 text-4xl font-semibold tabular-nums">
                  {result ? result.lotSize.toFixed(2) : '—'}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {result
                    ? result.lotSize > 0
                      ? `Actual risk: $${result.actualRiskUsd.toFixed(2)}`
                      : 'Below the 0.01 minimum lot step'
                    : 'Enter risk and stop-loss values'}
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Formula: risk ÷ stop-loss points. The result is rounded down to the nearest 0.01 lot so the calculated risk does not exceed your limit.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
