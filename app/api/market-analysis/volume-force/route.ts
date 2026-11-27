import {NextResponse} from 'next/server'
import {requireSessionUser} from '@/lib/auth/require-session-user'
import {fetchHistoricalCandles} from '@/lib/ticks/fetch'
import {attachTickVolume} from '@/lib/market-analysis/volume-acquisition'
export const runtime='nodejs'
export async function GET(request:Request){
 if(!await requireSessionUser())return NextResponse.json({error:'Unauthorized'},{status:401})
 const now=Date.now(),raw=new URL(request.url).searchParams.get('after')
 const after=raw===null?NaN:Number(raw)
 if(!Number.isSafeInteger(after)||after<0||after>now+180000||after%180000!==0)return NextResponse.json({error:'Invalid cursor'},{status:400})
 try{
  // Re-read two previous buckets to finalize the formerly active candle and
  // tolerate recent rollup corrections. Bound catch-up to 800 bars.
  const from=after-2*180000
  const limit=Math.max(3,Math.min(800,Math.ceil((now-from)/180000)+1))
  const bars=(await fetchHistoricalCandles({symbol:'EURUSD',timeframe:'3m',limit})).filter(b=>b.time*1000>=from&&b.time*1000<now)
  const volumeBars=await attachTickVolume(bars,now)
  return NextResponse.json({asOf:now,bars:volumeBars},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'Tick volume refresh failed'},{status:503})}
}
