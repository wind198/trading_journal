'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ConditionalOrderInput, ConditionalOrderResponse, Timeframe } from '@/lib/execution/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  symbol: string
  defaultEntryPrice?: string
}

const TIMEFRAMES: Timeframe[] = ['3m', '15m', '1h', '4h']

export function ExecutionOrderDrawer({ open, onOpenChange, symbol, defaultEntryPrice }: Props) {
  const queryClient = useQueryClient()
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [entryPrice, setEntryPrice] = useState(defaultEntryPrice ?? '1.09500')
  const [triggerPrice, setTriggerPrice] = useState(defaultEntryPrice ?? '1.09500')
  const [timeframe, setTimeframe] = useState<Timeframe>('3m')
  const [expiresAt, setExpiresAt] = useState('')
  const [stopLossPoints, setStopLossPoints] = useState('250')
  const [takeProfitPoints, setTakeProfitPoints] = useState('500')
  const [maxLossUsd, setMaxLossUsd] = useState('50.00')
  const [forceScoreMinimum, setForceScoreMinimum] = useState('')
  const [engulfingMinimumScore, setEngulfingMinimumScore] = useState('')

  useEffect(() => {
    if (defaultEntryPrice) {
      setEntryPrice(defaultEntryPrice)
      setTriggerPrice(defaultEntryPrice)
    }
  }, [defaultEntryPrice])

  const presence = useQuery({
    queryKey: ['execution-device-default'],
    queryFn: async () => {
      const res = await fetch('/api/execution/devices/default')
      if (!res.ok) throw new Error('Failed to load device presence')
      return res.json() as Promise<{ warehouseOnline: boolean; deviceId: string }>
    },
    refetchInterval: 5000,
    enabled: open,
  })

  const history = useQuery({
    queryKey: ['execution-conditional-orders'],
    queryFn: async () => {
      const res = await fetch('/api/execution/conditional-orders')
      if (!res.ok) throw new Error('Failed to load orders')
      return res.json() as Promise<{ data: Array<Record<string, unknown>> }>
    },
    refetchInterval: (q) => {
      const rows = q.state.data?.data ?? []
      const hasActive = rows.some((row) => {
        const state = String(row.execution_state ?? '')
        return !['FILLED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(state)
      })
      return hasActive ? 2000 : 30000
    },
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: async (body: ConditionalOrderInput) => {
      const res = await fetch('/api/execution/conditional-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await res.json()) as ConditionalOrderResponse & { message?: string; error?: string }
      if (!res.ok) {
        throw Object.assign(new Error(payload.message ?? payload.error ?? 'Install failed'), {
          status: res.status,
          payload,
        })
      }
      return payload
    },
    onSuccess: (data) => {
      toast.success(`Order ${data.orderId} ${data.result}`)
      void queryClient.invalidateQueries({ queryKey: ['execution-conditional-orders'] })
      onOpenChange(false)
    },
    onError: (error) => {
      const err = error as Error & { status?: number; payload?: ConditionalOrderResponse }
      if (err.status === 503) {
        toast.error('Warehouse offline — order was not queued.')
        return
      }
      if (err.status === 504) {
        toast.warning('Unknown outcome — reconcile by order ID before retrying.')
        return
      }
      toast.error(err.message)
    },
  })

  function submit() {
    const body: ConditionalOrderInput = {
      symbol,
      side,
      entryPrice,
      triggerPrice,
      timeframe,
      expiresAt: expiresAt || new Date(Date.now() + 86_400_000).toISOString(),
      stopLossPoints: Number(stopLossPoints),
      takeProfitPoints: Number(takeProfitPoints),
      maxLossUsd,
      forceScoreMinimum: forceScoreMinimum ? Number(forceScoreMinimum) : undefined,
      engulfingMinimumScore: engulfingMinimumScore ? Number(engulfingMinimumScore) : undefined,
    }
    createMutation.mutate(body)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conditional close order</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Warehouse connectivity:{' '}
          {presence.isLoading
            ? 'checking…'
            : presence.data?.warehouseOnline
              ? 'online'
              : 'offline (new installs rejected)'}
        </p>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={side === 'BUY' ? 'default' : 'outline'} onClick={() => setSide('BUY')}>
              BUY
            </Button>
            <Button type="button" variant={side === 'SELL' ? 'default' : 'outline'} onClick={() => setSide('SELL')}>
              SELL
            </Button>
          </div>
          <div>
            <Label htmlFor="entryPrice">Entry reference</Label>
            <Input id="entryPrice" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="triggerPrice">Trigger threshold</Label>
            <Input id="triggerPrice" value={triggerPrice} onChange={(e) => setTriggerPrice(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="timeframe">Timeframe</Label>
            <select
              id="timeframe"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="expiresAt">Expires (ISO)</Label>
            <Input id="expiresAt" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="2026-11-20T17:00:00Z" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="sl">Stop loss points</Label>
              <Input id="sl" value={stopLossPoints} onChange={(e) => setStopLossPoints(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tp">Take profit points</Label>
              <Input id="tp" value={takeProfitPoints} onChange={(e) => setTakeProfitPoints(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="risk">Max USD loss budget</Label>
            <Input id="risk" value={maxLossUsd} onChange={(e) => setMaxLossUsd(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="force">Force score min (optional)</Label>
              <Input id="force" value={forceScoreMinimum} onChange={(e) => setForceScoreMinimum(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="engulf">Engulfing min (optional)</Label>
              <Input id="engulf" value={engulfingMinimumScore} onChange={(e) => setEngulfingMinimumScore(e.target.value)} />
            </div>
          </div>
        </div>
        {history.data?.data?.length ? (
          <div className="rounded border p-2 text-xs space-y-1 max-h-32 overflow-y-auto">
            {history.data.data.slice(0, 5).map((row) => (
              <div key={String(row.order_id)} className="flex justify-between gap-2">
                <span>{String(row.order_id).slice(0, 8)}…</span>
                <span>{String(row.execution_state)}</span>
                <span>{row.calculated_volume_lots ? `${row.calculated_volume_lots} lots` : '—'}</span>
              </div>
            ))}
            <p className="text-muted-foreground">Projection may lag a few seconds after ARMED.</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending || presence.data?.warehouseOnline === false}>
            Install conditional order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}