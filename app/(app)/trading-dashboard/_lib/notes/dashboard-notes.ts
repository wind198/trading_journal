import { createClient } from '@/lib/supabase/client'

export type DashboardNote = {
  id: string
  symbol: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

type DashboardNoteRow = {
  id: string
  symbol: string
  title: string
  body: string
  pinned: boolean
  created_at: string
  updated_at: string
}

const NOTE_SELECT = 'id, symbol, title, body, pinned, created_at, updated_at'

function rowToNote(row: DashboardNoteRow): DashboardNote {
  return {
    id: row.id,
    symbol: row.symbol,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function sortNotes(notes: DashboardNote[]): DashboardNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export async function loadDashboardNotes(): Promise<DashboardNote[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('dashboard_notes')
    .select(NOTE_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return sortNotes((data as DashboardNoteRow[] | null)?.map(rowToNote) ?? [])
}

export async function insertDashboardNote(input: {
  symbol: string
  title: string
  body?: string
}): Promise<DashboardNote> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('dashboard_notes')
    .insert([
      {
        user_id: user.id,
        symbol: input.symbol,
        title: input.title,
        body: input.body ?? '',
        pinned: false,
      },
    ])
    .select(NOTE_SELECT)
    .single()
  if (error) throw error
  return rowToNote(data as DashboardNoteRow)
}

export async function updateDashboardNote(
  id: string,
  input: { title?: string; body?: string; pinned?: boolean },
): Promise<void> {
  const supabase = createClient()
  const payload: Record<string, string | boolean> = {
    updated_at: new Date().toISOString(),
  }
  if (input.title !== undefined) payload.title = input.title
  if (input.body !== undefined) payload.body = input.body
  if (input.pinned !== undefined) payload.pinned = input.pinned
  const { error } = await supabase.from('dashboard_notes').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteDashboardNote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('dashboard_notes').delete().eq('id', id)
  if (error) throw error
}
