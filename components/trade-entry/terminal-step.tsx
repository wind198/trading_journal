import { Button } from '@/components/ui/button'
import type {
  Answer,
  SetupDefinition,
  VerdictKind,
} from '@/lib/trade-entry/types'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

type TerminalStepProps = {
  title: string
  detail?: string
  tone?: 'neutral' | VerdictKind
  setup?: SetupDefinition | null
  answers?: Answer[]
  showAdvice?: boolean
  onClose: () => void
  disabled?: boolean
}

export function TerminalStep({
  title,
  detail,
  tone = 'neutral',
  setup,
  answers = [],
  showAdvice = false,
  onClose,
  disabled,
}: TerminalStepProps) {
  const titleColor =
    tone === 'safe'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground'
  const checklist = setup
    ? setup.questions.map((question, index) => ({
        question,
        answer: answers[index],
      }))
    : []
  const showPanel =
    Boolean(setup) || checklist.length > 0 || (showAdvice && setup?.advice.length)

  return (
    <div
      className={cn(
        'journal-form__terminal flex w-full max-w-md flex-col items-center gap-5 overflow-y-auto py-4 text-center',
        `journal-form__terminal--${tone}`
      )}
    >
      <h1
        className={cn(
          'journal-form__terminal-title text-2xl font-semibold',
          titleColor
        )}
      >
        {title}
      </h1>
      {detail && (
        <p className="journal-form__terminal-detail text-sm text-muted-foreground">
          {detail}
        </p>
      )}

      {showPanel && (
        <div className="journal-form__panel w-full rounded-xl border-0 md:border md:border-border md:bg-card md:p-4 md:text-left md:shadow-sm">
          {setup && (
            <>
              <p className="journal-form__section-label mb-3 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
                Summary
              </p>
              <ul className="journal-form__summary space-y-2 text-sm">
                <li className="journal-form__summary-row flex items-center justify-between gap-3">
                  <span className="journal-form__summary-key text-muted-foreground">
                    Direction
                  </span>
                  <span
                    className={cn(
                      'journal-form__summary-value font-medium',
                      setup.direction === 'BUY'
                        ? 'journal-form__summary-value--buy text-success'
                        : 'journal-form__summary-value--sell text-destructive'
                    )}
                  >
                    {setup.direction}
                  </span>
                </li>
                <li className="journal-form__summary-row flex items-center justify-between gap-3">
                  <span className="journal-form__summary-key text-muted-foreground">
                    Order type
                  </span>
                  <span className="journal-form__summary-value font-medium text-foreground">
                    {setup.label}
                  </span>
                </li>
              </ul>
            </>
          )}

          {checklist.length > 0 && (
            <>
              <p className="journal-form__section-label mb-2 mt-4 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
                Checklist
              </p>
              <ul className="journal-form__checklist space-y-3">
                {checklist.map((item) => {
                  const yes = item.answer === true
                  return (
                    <li
                      key={item.question}
                      className="journal-form__checklist-item flex items-start gap-3"
                    >
                      <span
                        className={cn(
                          'journal-form__check-icon mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                          yes
                            ? 'journal-form__check-icon--yes bg-success/15 text-success'
                            : 'journal-form__check-icon--no bg-destructive/15 text-destructive'
                        )}
                      >
                        {yes ? (
                          <Check className="size-3" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </span>
                      <span className="journal-form__check-text text-sm leading-snug text-foreground">
                        {item.question}
                        <span
                          className={cn(
                            'journal-form__check-answer ml-1.5 font-medium',
                            yes
                              ? 'journal-form__check-answer--yes text-success'
                              : 'journal-form__check-answer--no text-destructive'
                          )}
                        >
                          {yes ? 'Yes' : 'No'}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {showAdvice && setup && setup.advice.length > 0 && (
            <>
              <p className="journal-form__section-label mb-2 mt-4 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
                Advice
              </p>
              <ul className="journal-form__advice list-disc space-y-2 pl-4">
                {setup.advice.map((line) => (
                  <li
                    key={line}
                    className="journal-form__advice-item text-sm leading-snug text-foreground"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Button
        size="lg"
        className="journal-form__done w-full"
        onClick={onClose}
        disabled={disabled}
      >
        Done
      </Button>
    </div>
  )
}
