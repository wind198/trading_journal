import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ChoiceButtonProps = {
  label: string
  description?: string
  icon?: ReactNode
  active?: boolean
  tone?: 'buy' | 'sell'
  onClick: () => void
}

export function ChoiceButton({
  label,
  description,
  icon,
  active,
  tone,
  onClick,
}: ChoiceButtonProps) {
  const idle =
    tone === 'buy'
      ? 'border-success/40 bg-success/5 text-success'
      : tone === 'sell'
        ? 'border-destructive/40 bg-destructive/5 text-destructive'
        : 'border-0 bg-transparent md:border-border md:bg-card md:text-foreground'

  const selected =
    tone === 'buy'
      ? 'border-success bg-success/15 text-success'
      : tone === 'sell'
        ? 'border-destructive bg-destructive/15 text-destructive'
        : 'border-primary bg-primary/10 text-primary'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'journal-form__choice flex min-h-16 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border px-4 py-4 text-center transition active:scale-[0.98]',
        tone && `journal-form__choice--${tone}`,
        active && 'journal-form__choice--active',
        active ? selected : idle
      )}
    >
      <span className="journal-form__choice-label flex items-center gap-2 text-lg font-medium">
        {icon}
        {label}
      </span>
      {description && (
        <span
          className={cn(
            'journal-form__choice-desc text-sm font-normal leading-snug',
            active || tone ? 'opacity-80' : 'text-muted-foreground'
          )}
        >
          {description}
        </span>
      )}
    </button>
  )
}
