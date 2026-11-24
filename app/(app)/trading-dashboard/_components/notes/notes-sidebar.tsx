'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounceCallback } from 'usehooks-ts'
import { toast } from 'sonner'
import { Pencil, Pin, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  deleteDashboardNote,
  insertDashboardNote,
  loadDashboardNotes,
  sortNotes,
  updateDashboardNote,
  type DashboardNote,
} from '../../_lib/notes/dashboard-notes'
import { formatNoteTitle } from '../../_lib/notes/format-note-title'

const NOTE_BODY_DEBOUNCE_MS = 400
export const DASHBOARD_NOTES_QUERY_KEY = ['dashboard-notes'] as const

type NotesSidebarProps = {
  symbol: string
  onClose: () => void
  embedded?: boolean
}

function NoteBodyEditor({
  noteId,
  initialBody,
  onPersist,
  onFlush,
}: {
  noteId: string
  initialBody: string
  onPersist: (id: string, body: string) => void
  onFlush: () => void
}) {
  const [draftBody, setDraftBody] = useState(initialBody)

  return (
    <textarea
      value={draftBody}
      onChange={(e) => {
        const body = e.target.value
        setDraftBody(body)
        onPersist(noteId, body)
      }}
      onBlur={onFlush}
      placeholder="Write your note…"
      className={cn(
        'h-full min-h-32 w-full min-w-0 flex-1 resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-sm',
        'outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'dark:bg-input/30',
      )}
    />
  )
}

function NoteTitleRow({
  note,
  open,
  onToggle,
  onRename,
  onTogglePin,
  onDelete,
}: {
  note: DashboardNote
  open: boolean
  onToggle: () => void
  onRename: (title: string) => void
  onTogglePin: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(note.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraftTitle(note.title)
  }, [editing, note.title])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const commitTitle = () => {
    const next = draftTitle.trim()
    setEditing(false)
    if (!next || next === note.title) {
      setDraftTitle(note.title)
      return
    }
    onRename(next)
  }

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraftTitle(note.title)
    setEditing(true)
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 px-1 py-0.5">
      {editing ? (
        <Input
          ref={inputRef}
          value={draftTitle}
          aria-label="Note title"
          className="h-7 min-w-0 flex-1 px-1.5 text-sm font-medium"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitTitle()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setDraftTitle(note.title)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-left"
          aria-expanded={open}
          onClick={onToggle}
          onDoubleClick={startEditing}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{note.title}</span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              {note.title}
            </TooltipContent>
          </Tooltip>
          <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[10px] font-normal">
            {note.symbol}
          </Badge>
        </button>
      )}
      {!editing && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground"
          aria-label={`Rename note ${note.title}`}
          onClick={startEditing}
        >
          <Pencil className="size-3.5" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          'shrink-0',
          note.pinned ? 'text-amber-600 hover:text-amber-700' : 'text-muted-foreground',
        )}
        aria-label={note.pinned ? `Unpin note ${note.title}` : `Pin note ${note.title}`}
        aria-pressed={note.pinned}
        onClick={(e) => {
          e.stopPropagation()
          onTogglePin()
        }}
      >
        <Pin className={cn('size-3.5', note.pinned && 'fill-current')} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Delete note ${note.title}`}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

export function NotesSidebar({ symbol, onClose, embedded = false }: NotesSidebarProps) {
  const queryClient = useQueryClient()
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const notesQuery = useQuery({
    queryKey: DASHBOARD_NOTES_QUERY_KEY,
    queryFn: loadDashboardNotes,
  })

  const notes = useMemo(() => sortNotes(notesQuery.data ?? []), [notesQuery.data])

  const setNotesCache = useCallback(
    (updater: (prev: DashboardNote[]) => DashboardNote[]) => {
      queryClient.setQueryData<DashboardNote[]>(DASHBOARD_NOTES_QUERY_KEY, (prev) =>
        sortNotes(updater(prev ?? [])),
      )
    },
    [queryClient],
  )

  const persistBody = useDebounceCallback((id: string, body: string) => {
    setNotesCache((prev) => prev.map((n) => (n.id === id ? { ...n, body } : n)))
    void updateDashboardNote(id, { body }).catch(() => {
      toast.error('Failed to save note')
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_NOTES_QUERY_KEY })
    })
  }, NOTE_BODY_DEBOUNCE_MS)

  useEffect(() => () => { persistBody.flush() }, [persistBody])

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

  const onRenameNote = (note: DashboardNote, title: string) => {
    let previous: DashboardNote[] = []
    setNotesCache((prev) => {
      previous = prev
      return prev.map((n) => (n.id === note.id ? { ...n, title } : n))
    })
    void updateDashboardNote(note.id, { title }).catch(() => {
      setNotesCache(() => previous)
      toast.error('Failed to rename note')
    })
  }

  const onTogglePin = (note: DashboardNote) => {
    const nextPinned = !note.pinned
    let previous: DashboardNote[] = []
    setNotesCache((prev) => {
      previous = prev
      return prev.map((n) => (n.id === note.id ? { ...n, pinned: nextPinned } : n))
    })
    void updateDashboardNote(note.id, { pinned: nextPinned }).catch(() => {
      setNotesCache(() => previous)
      toast.error('Failed to update pin')
    })
  }

  const onDeleteNote = (id: string) => {
    persistBody.flush()
    let previous: DashboardNote[] = []
    setNotesCache((prev) => {
      previous = prev
      return prev.filter((n) => n.id !== id)
    })
    setExpandedNoteId((current) => (current === id ? null : current))
    void deleteDashboardNote(id).catch(() => {
      setNotesCache(() => previous)
      toast.error('Failed to delete note')
    })
  }

  const toggleExpanded = (id: string) => {
    persistBody.flush()
    setExpandedNoteId((current) => (current === id ? null : id))
  }

  return (
    <TooltipProvider>
      <aside
        className={embedded ? "flex min-h-0 flex-1 flex-col" : "absolute inset-y-0 right-0 z-30 flex w-80 max-w-[min(20rem,90vw)] flex-col border-l border-border bg-background/95 shadow-lg backdrop-blur-sm"}
        aria-label="Notes"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5">
          <h3 className="text-sm font-semibold">Notes</h3>
          <div className="flex items-center gap-0.5">
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
            {!embedded && <Button type="button" variant="ghost" size="icon-sm" aria-label="Close notes" onClick={onClose}><X /></Button>}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5">
          {notesQuery.isPending ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">Loading…</p>
          ) : notesQuery.isError ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">Unable to load notes</p>
          ) : notes.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              No notes yet. Tap + to create one.
            </p>
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {notes.map((note) => {
                const open = expandedNoteId === note.id
                return (
                  <li
                    key={note.id}
                    className={cn(
                      'flex min-h-0 flex-col rounded-md border border-border bg-background/80',
                      open && 'min-h-0 flex-1',
                    )}
                  >
                    <NoteTitleRow
                      note={note}
                      open={open}
                      onToggle={() => toggleExpanded(note.id)}
                      onRename={(title) => onRenameNote(note, title)}
                      onTogglePin={() => onTogglePin(note)}
                      onDelete={() => onDeleteNote(note.id)}
                    />
                    {open && (
                      <div className="flex min-h-0 flex-1 flex-col border-t border-border p-1.5">
                        <NoteBodyEditor
                          key={note.id}
                          noteId={note.id}
                          initialBody={note.body}
                          onPersist={persistBody}
                          onFlush={() => persistBody.flush()}
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
    </TooltipProvider>
  )
}
