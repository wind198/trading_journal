export const DISCIPLINE_ITEMS = [
  {
    key: 'calendar_events',
    label: 'Check trading calendar events',
  },
  {
    key: 'avoid_danger_session',
    label: 'Avoid the danger session (14:00–21:00 UTC+7)',
  },
  {
    key: 'record_journal',
    label: 'Record trades in the journal',
  },
  {
    key: 'no_sl_extension',
    label: 'No stop-loss extension',
  },
  {
    key: 'max_concurrent_orders',
    label: 'Max 3 concurrent orders',
  },
  {
    key: 'max_risk_units',
    label: 'Max 2 risk units at once (1 risk = fixed $ amount)',
  },
] as const

export type DisciplineItemKey = (typeof DISCIPLINE_ITEMS)[number]['key']

export const DISCIPLINE_ITEM_KEYS = DISCIPLINE_ITEMS.map((item) => item.key)

export function isDisciplineItemKey(value: string): value is DisciplineItemKey {
  return (DISCIPLINE_ITEM_KEYS as readonly string[]).includes(value)
}
