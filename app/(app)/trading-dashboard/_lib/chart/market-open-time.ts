import { createClient } from '@/lib/supabase/client'
import { SESSION_LINE_SLOTS, defaultSessionOpenTimes, defaultSessionSlotEnabled, type SessionOpenTimes, type SessionSlotId } from './chart-timezone'
export type MarketOpenConfig = { times: SessionOpenTimes; enabled: Record<SessionSlotId, boolean> }
export type MarketOpenRow = { market: SessionSlotId; open_hour: number; open_minute: number; enabled: boolean }
export function defaultMarketOpenConfig(): MarketOpenConfig {
  return { times: defaultSessionOpenTimes(), enabled: defaultSessionSlotEnabled() }
}
export function marketOpenConfigFromRows(rows: readonly MarketOpenRow[]): MarketOpenConfig {
  const config=defaultMarketOpenConfig()
  for(const row of rows) {
    if(!SESSION_LINE_SLOTS.some(slot=>slot.id===row.market)) continue
    if(!Number.isInteger(row.open_hour)||row.open_hour<0||row.open_hour>23||!Number.isInteger(row.open_minute)||row.open_minute<0||row.open_minute>59||typeof row.enabled!=='boolean') continue
    config.times[row.market]={hour:row.open_hour,minute:row.open_minute}
    config.enabled[row.market]=row.enabled
  }
  return config
}
export function marketOpenRows(config: MarketOpenConfig): MarketOpenRow[] {
  return SESSION_LINE_SLOTS.map(({id})=>({market:id,open_hour:config.times[id].hour,open_minute:config.times[id].minute,enabled:config.enabled[id]}))
}
async function requireUser(client:ReturnType<typeof createClient>) {
  const {data:{user},error}=await client.auth.getUser()
  if(error||!user) throw new Error('Sign in to edit market opening times')
  return user.id
}
export async function loadMarketOpenConfig(client=createClient()):Promise<MarketOpenConfig> {
  const userId=await requireUser(client)
  const {data,error}=await client.from('market_open_time').select('market,open_hour,open_minute,enabled').eq('user_id',userId)
  if(error) throw error
  return marketOpenConfigFromRows((data??[]) as MarketOpenRow[])
}
export async function saveMarketOpenConfig(config:MarketOpenConfig,client=createClient()):Promise<void> {
  const userId=await requireUser(client)
  const rows=marketOpenRows(config).map(row=>({...row,user_id:userId,updated_at:new Date().toISOString()}))
  const {error}=await client.from('market_open_time').upsert(rows,{onConflict:'user_id,market'})
  if(error) throw error
}
