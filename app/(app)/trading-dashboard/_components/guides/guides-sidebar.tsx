'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePaneBias } from '../../_hooks/usePaneBias'
import { compoundForRegimes } from '../../_lib/guides/compounds'
import { regimeFromBias, type Regime } from '../../_lib/guides/regime'

type Override = 'auto' | Regime

const SELECT_CLASS = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'dark:bg-input/30',
)

function effectiveRegime(computed: Regime | null, override: Override): Regime | null {
  return override === 'auto' ? computed : override
}

function autoLabel(computed: Regime | null): string {
  if (computed == null) return 'Auto (—)'
  return computed === 'choppy' ? 'Auto (choppy)' : 'Auto (trending)'
}

function RegimeSelect({
  id,
  label,
  computed,
  override,
  onOverride,
}: {
  id: string
  label: string
  computed: Regime | null
  override: Override
  onOverride: (value: Override) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {computed != null && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            calc {computed}
          </Badge>
        )}
      </div>
      <select
        id={id}
        className={SELECT_CLASS}
        value={override}
        onChange={(event) => onOverride(event.target.value as Override)}
      >
        <option value="auto">{autoLabel(computed)}</option>
        <option value="choppy">Choppy</option>
        <option value="trending">Trending</option>
      </select>
    </div>
  )
}

export function GuidesSidebar({ onClose }: { onClose: () => void }) {
  const bias15 = usePaneBias('15m')
  const bias3 = usePaneBias('3m')
  const auto15 = regimeFromBias(bias15)
  const auto3 = regimeFromBias(bias3)
  const [override15, setOverride15] = useState<Override>('auto')
  const [override3, setOverride3] = useState<Override>('auto')

  const htf = effectiveRegime(auto15, override15)
  const ltf = effectiveRegime(auto3, override3)
  const compound = htf && ltf ? compoundForRegimes(htf, ltf) : null

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-80 max-w-[min(20rem,90vw)] flex-col border-l border-border bg-background/95 shadow-lg backdrop-blur-sm"
      aria-label="Trading guides"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold">Guides</h3>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close guides" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <RegimeSelect
          id="guide-15m"
          label="15m"
          computed={auto15}
          override={override15}
          onOverride={setOverride15}
        />
        <RegimeSelect
          id="guide-3m"
          label="3m"
          computed={auto3}
          override={override3}
          onOverride={setOverride3}
        />

        <div className="border-t border-border pt-3">
          {htf == null || ltf == null ? (
            <p className="text-sm text-muted-foreground">Waiting for 15m / 3m bias…</p>
          ) : compound == null ? (
            <p className="text-sm text-muted-foreground">No guides for this pair</p>
          ) : (
            <>
              <h4 className="text-sm font-medium">{compound.title}</h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
                {compound.guides.map((guide) => (
                  <li key={guide}>{guide}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
