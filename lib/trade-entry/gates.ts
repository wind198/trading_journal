import type {
  EntryGate,
  EntryGateContext,
  GateBlock,
} from '@/lib/trade-entry/types'

export const MAX_TRADES_PER_DAY = 3

export function isBlockedSession(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? 0
  )
  const minutes = hour * 60 + minute
  return minutes >= 14 * 60 && minutes < 21 * 60
}

export const dailyTradeLimitGate: EntryGate = async (context) => {
  try {
    const count = await context.getTodayTradeCount()
    return count >= MAX_TRADES_PER_DAY
      ? { value: 'blocked', reason: 'daily-limit', count }
      : null
  } catch (error) {
    // Preserve existing fail-open behavior if the count query is unavailable.
    context.onError?.(error)
    return null
  }
}

export const blockedSessionGate: EntryGate = async (context) =>
  isBlockedSession(context.now)
    ? { value: 'blocked', reason: 'session' }
    : null

const ENTRY_GATES: readonly EntryGate[] = [
  dailyTradeLimitGate,
  blockedSessionGate,
]

export async function runEntryGates(
  context: EntryGateContext,
  gates: readonly EntryGate[] = ENTRY_GATES
): Promise<GateBlock | null> {
  for (const gate of gates) {
    const result = await gate(context)
    if (result) return result
  }
  return null
}
