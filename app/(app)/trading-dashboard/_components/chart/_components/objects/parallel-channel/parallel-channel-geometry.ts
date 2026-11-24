import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
export type ChannelPoints = [DrawingPoint, DrawingPoint, DrawingPoint]
export function channelGeometry([a,b,c]: ChannelPoints) {
  if (![a,b,c].every(p => Number.isFinite(p.time) && Number.isFinite(p.price))) return null
  const dt = b.time - a.time
  if (Math.round(a.time) === Math.round(b.time)) return null
  const slope = (b.price-a.price)/dt
  const offset = c.price - (a.price + slope*(c.time-a.time))
  if (!Number.isFinite(offset)) return null
  const shift = (p: DrawingPoint, ratio: number) => ({time:p.time,price:p.price+offset*ratio})
  return { baseline:[a,b] as const, opposite:[shift(a,1),shift(b,1)] as const, middle:[shift(a,.5),shift(b,.5)] as const, offset }
}
export function moveChannel(points: ChannelPoints, vertex: number, origin: DrawingPoint, next: DrawingPoint): ChannelPoints {
  const moved = points.map((p,i) => vertex < 0 ? {time:p.time+next.time-origin.time,price:p.price+next.price-origin.price} : i===vertex ? next : p) as ChannelPoints
  return channelGeometry(moved) ? moved : points
}
