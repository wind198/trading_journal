'use client'

import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounceCallback } from 'usehooks-ts'
import { toast } from 'sonner'
import { ChevronDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  insertDashboardNote,
  loadDashboardNotes,
  updateDashboardNote,
  type DashboardNote,
} from '../../_lib/notes/dashboard-notes'
import { formatNoteTitle } from '../../_lib/notes/format-note-title'

const NOTE_BODY_DEBOUNCE_MS = 400
const DASHBOARD_NOTES_QUERY_KEY = ['dashboard-notes'] as const

type NotesSidebarProps = {
  symbol: string
  onClose: () => void
}

export function NotesSidebar({ symbol, onClose }: NotesSidebarProps) {
  const queryClient = useQueryClient()
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const notesQuery = useQuery({
    queryKey: DASHBOARD_NOTES_QUERY_KEY,
    queryFn: loadDashboardNotes,
  })

  const notes = notesQuery.data ?? []

  const persistBody = useDebounceCallback((id: string, body: string) => {
    void updateDashboardNote(id, { body }).catch(() => {
      toast.error('Failed to save note')
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_NOTES_QUERY_KEY })
    })
  }, NOTE_BODY_DEBOUNCE_MS)

  const setNotesCache = useCallback(
    (updater: (prev: DashboardNote[]) => DashboardNote[]) => {
      queryClient.setQueryData<DashboardNote[]>(DASHBOARD_NOTES_QUERY_KEY, (prev) =>
        updater(prev ?? []),
      )
    },
    [queryClient],
  )

  const onCreateNote = () => {
    if (creating) return
    setCreating(true)
    const title = formatNoteTitle(symbol)
    void insertDashboardNote({ symbol, title, body: '' })
      .then((note) => {
        setNotesCache((prev) => [note, ...prev])
        setExpandedNoteId(note.id)
      })
      .catch(() => {
        toast.error('Failed to create note')
      })
      .finally(() => {
        setCreating(false)
      })
  }

  const onBodyChange = (id: string, body: string) => {
    setNotesCache((prev) => prev.map((n) => (n.id === id ? { ...n, body } : n)))
    persistBody(id, body)
  }

  const toggleExpanded = (id: string) => {
    setExpandedNoteId((current) => (current === id ? null : id))
  }

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-80 max-w-[min(20rem,90vw)] flex-col border-l border-border bg-background/95 shadow-lg backdrop-blur-sm"
      aria-label="Notes"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="New note"
            disabled={creating}
            onClick={onCreateNote}
          >
            <Plus />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close notes" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {notesQuery.isPending ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">Loading…</p>
        ) : notesQuery.isError ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">Unable to load notes</p>
        ) : notes.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            No notes yet. Tap + to create one.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {notes.map((note) => {
              const open = expandedNoteId === note.id
              return (
                <li key={note.id} className="rounded-lg border border-border bg-background/80">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
                    aria-expanded={open}
                    onClick={() => toggleExpanded(note.id)}
                  >
                    <ChevronDown
                      className={cn(
                        'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
                        !open && '-rotate-90',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{note.title}</span>
                      <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                        {note.symbol}
                      </Badge>
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-border px-2.5 pb-2.5 pt-1">
                      <textarea
                        value={note.body}
                        onChange={(e) => onBodyChange(note.id, e.target.value)}
                        placeholder="Write your note…"
                        rows={6}
                        className={cn(
                          'w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm',
                          'outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                          'dark:bg-input/30',
                        )}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
