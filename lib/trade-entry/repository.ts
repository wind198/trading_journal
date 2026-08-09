import { todayVn, vnRangeToUtcBounds } from '@/lib/date-range'
import { createClient } from '@/lib/supabase/client'

type BrowserSupabaseClient = ReturnType<typeof createClient>

export type TradeEntryRepository = {
  getTodayTradeCount: () => Promise<number>
}

export function createTradeEntryRepository(
  supabase: BrowserSupabaseClient
): TradeEntryRepository {
  return {
    async getTodayTradeCount() {
      const today = todayVn()
      const { startIso, endIso } = vnRangeToUtcBounds(today, today)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return 0

      const { count, error } = await supabase
        .from('trading_journal')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startIso)
        .lt('created_at', endIso)

      if (error) throw error
      return count ?? 0
    },
  }
}
