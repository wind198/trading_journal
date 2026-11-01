'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePaneBias } from '../../_hooks/usePaneBias'
import { articleForRegime, type GuideSection } from '../../_lib/guides/articles'
import { regimeFromBias, type Regime } from '../../_lib/guides/regime'

type Override = 'auto' | Regime

const SELECT_CLASS = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'dark:bg-input/30',
)

const REGIME_OPTIONS: { value: Regime; label: string }[] = [
  { value: 'choppy', label: 'Choppy' },
  { value: 'uptrend', label: 'Uptrend' },
  { value: 'downtrend', label: 'Downtrend' },
]

function effectiveRegime(computed: Regime | null, override: Override): Regime | null {
  return override === 'auto' ? computed : override
}

function autoLabel(computed: Regime | null): string {
  return computed == null ? 'Auto (—)' : `Auto (${computed})`
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
        {REGIME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function ArticleSection({ section }: { section: GuideSection }) {
  return (
    <section className="space-y-1.5">
      <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{section.title}</h5>
      {section.bullets != null && section.bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {section.variants?.map((variant) => (
        <div key={variant.title} className="space-y-1">
          <p className="text-sm font-medium">{variant.title}</p>
          {variant.body.map((paragraph) => (
            <p key={paragraph} className="text-sm">
              {paragraph}
            </p>
          ))}
          {variant.bullets != null && variant.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {variant.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}

export function GuidesSidebar({ onClose }: { onClose: () => void }) {
  const biasHtf = usePaneBias('15m')
  const biasPrimary = usePaneBias('3m')
  const autoHtf = regimeFromBias(biasHtf)
  const autoPrimary = regimeFromBias(biasPrimary)
  const [overrideHtf, setOverrideHtf] = useState<Override>('auto')
  const [overridePrimary, setOverridePrimary] = useState<Override>('auto')

  const htf = effectiveRegime(autoHtf, overrideHtf)
  const primary = effectiveRegime(autoPrimary, overridePrimary)
  const article = primary != null ? articleForRegime(primary) : null

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
          id="guide-htf"
          label="Higher TF"
          computed={autoHtf}
          override={overrideHtf}
          onOverride={setOverrideHtf}
        />
        <RegimeSelect
          id="guide-primary"
          label="Primary"
          computed={autoPrimary}
          override={overridePrimary}
          onOverride={setOverridePrimary}
        />

        <div className="space-y-4 border-t border-border pt-3">
          {article == null ? (
            <p className="text-sm text-muted-foreground">Waiting for Primary bias…</p>
          ) : (
            <>
              <h4 className="text-sm font-medium">
                {article.title}
                {htf != null && (
                  <span className="ml-1 font-normal text-muted-foreground">· HTF {htf}</span>
                )}
              </h4>
              {article.sections.map((section) => (
                <ArticleSection key={section.title} section={section} />
              ))}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
