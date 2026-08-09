'use client'

import { useEffect, useState } from 'react'
import { Quote, QuoteFormData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Plus } from 'lucide-react'

type QuoteFormProps = {
  editingQuote?: Quote | null
  onCancelEdit?: () => void
  onSubmit: (data: QuoteFormData) => Promise<void>
  isSaving?: boolean
}

export function QuoteForm({
  editingQuote = null,
  onCancelEdit,
  onSubmit,
  isSaving = false,
}: QuoteFormProps) {
  const [open, setOpen] = useState(false)
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')

  const isEditing = Boolean(editingQuote)

  useEffect(() => {
    if (editingQuote) {
      setHeadline(editingQuote.headline)
      setDescription(editingQuote.description)
      setOpen(true)
    }
  }, [editingQuote])

  const reset = () => {
    setHeadline('')
    setDescription('')
    setOpen(false)
    onCancelEdit?.()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedHeadline = headline.trim()
    const trimmedDescription = description.trim()
    if (!trimmedHeadline || !trimmedDescription) return

    await onSubmit({
      headline: trimmedHeadline,
      description: trimmedDescription,
    })
    reset()
  }

  if (!open) {
    return (
      <div className="quote-form">
        <Button
          type="button"
          size="lg"
          className="quote-form__open-btn h-14 w-full gap-2 text-[15px] font-bold shadow-sm"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-5" />
          Add quote
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="quote-form quote-form--open space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4"
    >
      <div className="quote-form__fields space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="quote-headline">Headline</Label>
          <Input
            id="quote-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Short title"
            required
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-description">Description</Label>
          <textarea
            id="quote-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Full note or quote"
            required
            rows={3}
            className="flex w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="quote-form__actions flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={reset}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1 gap-2" disabled={isSaving}>
          {isEditing ? (
            <>
              <Pencil className="size-4" />
              Save quote
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Add quote
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
