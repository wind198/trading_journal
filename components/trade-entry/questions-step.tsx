import type { Answer, SetupDefinition } from '@/lib/trade-entry/types'
import { ChoiceButton } from '@/components/trade-entry/choice-button'

type QuestionsStepProps = {
  setup: SetupDefinition
  index: number
  answers: Answer[]
  onAnswer: (answer: boolean) => void
}

export function QuestionsStep({
  setup,
  index,
  answers,
  onAnswer,
}: QuestionsStepProps) {
  return (
    <div className="journal-form__step journal-form__step--questions contents">
      <p className="journal-form__meta text-sm text-muted-foreground">
        Question {index + 1} / {setup.questions.length}
      </p>
      <h1 className="journal-form__title journal-form__title--question text-center text-xl font-semibold leading-snug">
        {setup.questions[index]}
      </h1>
      <div className="journal-form__choices journal-form__choices--binary grid w-full max-w-sm grid-cols-2 gap-4">
        <ChoiceButton
          label="Yes"
          active={answers[index] === true}
          tone="buy"
          onClick={() => onAnswer(true)}
        />
        <ChoiceButton
          label="No"
          active={answers[index] === false}
          tone="sell"
          onClick={() => onAnswer(false)}
        />
      </div>
    </div>
  )
}
