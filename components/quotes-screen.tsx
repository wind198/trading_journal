'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Quote, QuoteFormData } from '@/lib/types'
import { QuoteCard } from '@/components/quote-card'
import { QuoteForm } from '@/components/quote-form'
import { Skeleton } from '@/components/ui/skeleton'

export function QuotesScreen() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)

  const loadQuotes = async (uid: string) => {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (error) throw error
    setQuotes((data as Quote[]) || [])
  }

  useEffect(() => {
    const boot = async () => {
      setIsLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)
        await loadQuotes(user.id)
      } catch (error) {
        console.error('[quotes] load error:', error)
        toast.error('Failed to load quotes')
      } finally {
        setIsLoading(false)
      }
    }
    void boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const handleSubmit = async (data: QuoteFormData) => {
    if (!userId) return

    setIsSaving(true)
    try {
      if (editingQuote) {
        const { data: updated, error } = await supabase
          .from('quotes')
          .update({
            headline: data.headline,
            description: data.description,
          })
          .eq('id', editingQuote.id)
          .eq('user_id', userId)
          .select('*')
          .single()

        if (error) throw error
        setQuotes((prev) =>
          prev.map((q) => (q.id === editingQuote.id ? (updated as Quote) : q))
        )
        setEditingQuote(null)
        toast.success('Quote updated')
        return
      }

      const { data: created, error } = await supabase
        .from('quotes')
        .insert([
          {
            user_id: userId,
            headline: data.headline,
            description: data.description,
          },
        ])
        .select('*')
        .single()

      if (error) throw error
      setQuotes((prev) => [created as Quote, ...prev])
      toast.success('Quote added')
    } catch (error) {
      console.error('[quotes] save error:', error)
      toast.error(editingQuote ? 'Error updating quote' : 'Error saving quote')
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (quote: Quote) => {
    if (!userId) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quote.id)
        .eq('user_id', userId)
      if (error) throw error
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id))
      if (editingQuote?.id === quote.id) setEditingQuote(null)
      setExpanded((prev) => {
        if (!(quote.id in prev)) return prev
        const next = { ...prev }
        delete next[quote.id]
        return next
      })
      toast.success('Quote deleted')
    } catch (error) {
      console.error('[quotes] delete error:', error)
      toast.error('Error deleting quote')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="quotes-screen flex flex-col gap-6">
      <section className="quotes-screen__form-section">
        <QuoteForm
          editingQuote={editingQuote}
          isSaving={isSaving}
          onCancelEdit={() => setEditingQuote(null)}
          onSubmit={handleSubmit}
        />
      </section>

      <section className="quotes-screen__list-section space-y-3">
        <h2 className="quotes-screen__heading text-sm font-medium uppercase tracking-[0.06em] text-neutral">
          Quotes
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : quotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 px-6 py-10 text-center text-sm text-muted-foreground">
            No quotes yet. Add your first one above.
          </div>
        ) : (
          <div className="quotes-screen__list space-y-1.5">
            {quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                expanded={expanded[quote.id] === true}
                onToggle={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [quote.id]: !prev[quote.id],
                  }))
                }
                onEdit={(q) => {
                  setEditingQuote(q)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onDelete={(q) => void handleDelete(q)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
