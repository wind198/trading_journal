import type { Candle } from './contracts'

export type Series = readonly (number | null)[]
export type IchimokuConfig = { tenkan: number; kijun: number; spanB: number; displacement: number }
export type FoundationConfig = {
  atr: { period: number }; adxDmi: { period: number }; efficiencyRatio: { period: number };
  bollinger: { period: number; stdDev: number }; ichimoku: IchimokuConfig;
  regression: { periods: readonly number[] };
}
function period(n: number) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 10000) throw new RangeError('invalid period')
}
const mean = (xs: readonly number[]) => xs.reduce((a,b)=>a+b,0)/xs.length
export function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null
  const v = a/b
  return Number.isFinite(v) ? v : null
}
/** Seed with arithmetic mean of the first n contiguous valid samples. */
export function wilder(xs: Series, n: number): Series {
  period(n)
  let seed: number[] = [], prev: number | null = null
  return xs.map(x => {
    if (x === null || !Number.isFinite(x)) { seed=[]; prev=null; return null }
    if (prev === null) {
      seed.push(x)
      if (seed.length < n) return null
      prev=mean(seed)
    } else prev=(prev*(n-1)+x)/n
    return prev
  })
}
export function trueRange(bars: readonly Candle[]): Series {
  return bars.map((b,i)=>i===0?null:Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)))
}
export function atr(bars: readonly Candle[], n: number): Series { return wilder(trueRange(bars),n) }
export function dmi(bars: readonly Candle[], n: number) {
  const tr=wilder(trueRange(bars),n)
  const plus=wilder(bars.map((b,i)=>{
    if(!i)return null
    const up=b.high-bars[i-1].high, down=bars[i-1].low-b.low
    return up>down && up>0?up:0
  }),n)
  const minus=wilder(bars.map((b,i)=>{
    if(!i)return null
    const up=b.high-bars[i-1].high, down=bars[i-1].low-b.low
    return down>up && down>0?down:0
  }),n)
  const di=(x:Series)=>x.map((v,i)=>{const r=ratio(v,tr[i]);return r===null?null:r*100})
  const plusDI=di(plus), minusDI=di(minus)
  const dx=plusDI.map((p,i)=>{
    const m=minusDI[i]
    if(p===null||m===null)return null
    const r=ratio(Math.abs(p-m),p+m)
    return r===null?null:100*r
  })
  return {plusDI,minusDI,adx:wilder(dx,n)}
}
export function efficiencyRatio(bars: readonly Candle[], n: number): Series {
  period(n)
  return bars.map((b,i)=>{
    if(i<n)return null
    let travel=0
    for(let j=i-n+1;j<=i;j++)travel+=Math.abs(bars[j].close-bars[j-1].close)
    return ratio(Math.abs(b.close-bars[i-n].close),travel)
  })
}
export function bollinger(bars: readonly Candle[], n: number, k: number) {
  period(n)
  if(!Number.isFinite(k)||k<=0)throw new RangeError('invalid band multiplier')
  const middle: (number|null)[]=[],upper:(number|null)[]=[],lower:(number|null)[]=[],percentB:(number|null)[]=[],bandwidth:(number|null)[]=[]
  bars.forEach((b,i)=>{
    if(i<n-1){middle.push(null);upper.push(null);lower.push(null);percentB.push(null);bandwidth.push(null);return}
    const xs=bars.slice(i-n+1,i+1).map(x=>x.close),m=mean(xs)
    const sd=Math.sqrt(mean(xs.map(x=>(x-m)**2))),u=m+k*sd,l=m-k*sd
    middle.push(m);upper.push(u);lower.push(l);percentB.push(ratio(b.close-l,u-l));bandwidth.push(ratio(u-l,m))
  })
  return {middle,upper,lower,percentB,bandwidth}
}
export function regression(bars: readonly Candle[], n: number) {
  period(n);if(n<2)throw new RangeError('regression requires two bars')
  const slope:(number|null)[]=[],rSquared:(number|null)[]=[]
  const xm=(n-1)/2,xx=n*(n*n-1)/12
  bars.forEach((_,i)=>{
    if(i<n-1){slope.push(null);rSquared.push(null);return}
    const ys=bars.slice(i-n+1,i+1).map(b=>b.close),ym=mean(ys)
    let xy=0,yy=0
    ys.forEach((y,j)=>{xy+=(j-xm)*(y-ym);yy+=(y-ym)**2})
    slope.push(xy/xx);const r=ratio(xy*xy,xx*yy);rSquared.push(r===null?null:Math.min(1,r))
  })
  return {slope,rSquared}
}
export function ichimokuSeries(bars: readonly Candle[], cfg: IchimokuConfig) {
  for(const n of [cfg.tenkan,cfg.kijun,cfg.spanB,cfg.displacement])period(n)
  const midpoint=(n:number)=>bars.map((_,i)=>{
    if(i<n-1)return null
    let hi=-Infinity,lo=Infinity
    for(let j=i-n+1;j<=i;j++){hi=Math.max(hi,bars[j].high);lo=Math.min(lo,bars[j].low)}
    return (hi+lo)/2
  })
  const tenkan=midpoint(cfg.tenkan),kijun=midpoint(cfg.kijun),projectedB=midpoint(cfg.spanB)
  const projectedA=tenkan.map((t,i)=>t===null||kijun[i]===null?null:(t+kijun[i]!)/2)
  // The raw span at i is projected to i+displacement; aligned spans at i
  // only read raw values from i-displacement. Displacement counts actual bars.
  const align=(s:Series)=>bars.map((_,i)=>i<cfg.displacement?null:s[i-cfg.displacement])
  return {tenkan,kijun,projectedA,projectedB,alignedA:align(projectedA),alignedB:align(projectedB)}
}
export function percentile(current: number|null, history: Series): number|null {
  if(current===null||!Number.isFinite(current)||history.length===0||history.some(x=>x===null||!Number.isFinite(x)))return null
  return 100*history.reduce<number>((sum,x)=>sum+(x!<current?1:x===current?0.5:0),0)/history.length
}
export function calculateFoundation(bars: readonly Candle[], cfg: FoundationConfig) {
  return {atr:atr(bars,cfg.atr.period),dmi:dmi(bars,cfg.adxDmi.period),
    efficiencyRatio:efficiencyRatio(bars,cfg.efficiencyRatio.period),
    bollinger:bollinger(bars,cfg.bollinger.period,cfg.bollinger.stdDev),
    ichimoku:ichimokuSeries(bars,cfg.ichimoku),
    regression:cfg.regression.periods.map(n=>({period:n,...regression(bars,n)}))}
}
