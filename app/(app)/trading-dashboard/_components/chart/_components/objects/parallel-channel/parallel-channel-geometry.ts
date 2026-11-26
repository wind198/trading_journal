import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
export type ChannelPoints = [DrawingPoint,DrawingPoint,DrawingPoint]
export type ScreenPoint = {x:number;y:number}
/** Two equal-length screen segments, with the second passing through C. */
export function channelSegments(a:ScreenPoint,b:ScreenPoint,c:ScreenPoint) {
  const dx=b.x-a.x
  if(![a.x,a.y,b.x,b.y,c.x,c.y].every(Number.isFinite)||Math.abs(dx)<1e-6)return null
  const dy=b.y-a.y
  const offset=c.y-(a.y+dy*(c.x-a.x)/dx)
  return [[a,b],[{x:a.x,y:a.y+offset},{x:b.x,y:b.y+offset}]] as const
}
export function validChannelBaseline(a:DrawingPoint,b:DrawingPoint) {
  return Number.isFinite(a.time)&&Number.isFinite(b.time)&&Number.isFinite(a.price)&&Number.isFinite(b.price)&&Math.round(a.time)!==Math.round(b.time)
}
export function moveChannel(points:ChannelPoints,vertex:number,origin:DrawingPoint,next:DrawingPoint):ChannelPoints {
  const moved=points.map((p,i)=>vertex<0?{time:p.time+next.time-origin.time,price:p.price+next.price-origin.price}:i===vertex?next:p) as ChannelPoints
  return validChannelBaseline(moved[0],moved[1])&&moved.every(p=>Number.isFinite(p.time)&&Number.isFinite(p.price)&&p.time>0)?moved:points
}
