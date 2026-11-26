import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type { IChartApi,ISeriesApi,ISeriesPrimitive,PrimitiveHoveredItem,SeriesAttachedParameter,SeriesType,Time } from 'lightweight-charts'
import { chartXAtTime,type BarTimeSeries } from '../../../../../_lib/chart/chart-coordinates'
import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
import { channelSegments,type ChannelPoints,type ScreenPoint } from './parallel-channel-geometry'
export type ParallelChannelDrawing={id:string;points:ChannelPoints}
type Draft={p1:DrawingPoint;p2?:DrawingPoint;p3?:DrawingPoint}
type Geometry={id:string;anchors:ScreenPoint[];lines:readonly (readonly [ScreenPoint,ScreenPoint])[];draft:boolean;selected:boolean}
function distance(p:ScreenPoint,a:ScreenPoint,b:ScreenPoint){
  const dx=b.x-a.x,dy=b.y-a.y
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)))
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)
}
class ChannelView {
  private items:Geometry[]=[]
  constructor(private source:ParallelChannelPrimitive){}
  zOrder(){return 'top' as const}
  update(){
    const {chart,series,bars}=this.source
    this.items=[]
    if(!chart||!series)return
    const project=(p:DrawingPoint):ScreenPoint|null=>{
      const x=chartXAtTime(chart,p.time,bars),y=series.priceToCoordinate(p.price)
      return x==null||y==null?null:{x:Number(x),y:Number(y)}
    }
    const push=(id:string,points:DrawingPoint[],draft:boolean)=>{
      const anchors=points.map(project)
      if(anchors.some(p=>!p))return
      const a=anchors as ScreenPoint[]
      const lines=a.length===3?channelSegments(a[0]!,a[1]!,a[2]!)??[]:a.length===2?[[a[0]!,a[1]!] as const]:[]
      this.items.push({id,anchors:a,lines,draft,selected:id===this.source.selectedId})
    }
    for(const item of this.source.channels)push(item.id,item.points,false)
    const d=this.source.draft
    if(d)push('draft',[d.p1,...(d.p2?[d.p2]:[]),...(d.p2&&d.p3?[d.p3]:[])],true)
  }
  renderer(){return {draw:(target:CanvasRenderingTarget2D)=>target.useMediaCoordinateSpace(({context})=>{
    context.save()
    for(const item of this.items){
      const color=item.draft?'rgba(0,82,255,.55)':item.selected?'#F0AD4E':'#0052FF'
      context.strokeStyle=color;context.fillStyle=color;context.lineWidth=item.selected?2.5:1.5
      context.setLineDash(item.draft?[4,3]:[])
      for(const [a,b] of item.lines){context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke()}
      if(item.selected||item.draft)for(const a of item.anchors){context.beginPath();context.arc(a.x,a.y,4,0,Math.PI*2);context.fill()}
    }
    context.restore()
  })}}
  anchor(id:string,p:ScreenPoint):number {
    const item=this.items.find(v=>v.id===id&&v.selected&&!v.draft)
    if(!item)return -1
    let best=-1,dist=8*this.source.hitBoost
    item.anchors.forEach((a,i)=>{const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<=dist){dist=d;best=i}})
    return best
  }
  hit(p:ScreenPoint):PrimitiveHoveredItem|null{
    let best:{id:string;distance:number}|null=null
    for(const item of this.items){
      if(item.draft)continue
      const anchorDistance=item.selected?Math.min(...item.anchors.map(a=>Math.hypot(p.x-a.x,p.y-a.y))):Infinity
      const lineDistance=Math.min(...item.lines.map(([a,b])=>distance(p,a,b)))
      const d=Math.min(lineDistance<=6*this.source.hitBoost?lineDistance:Infinity,anchorDistance<=8*this.source.hitBoost?anchorDistance:Infinity)
      if(Number.isFinite(d)&&(!best||d<best.distance))best={id:item.id,distance:d}
    }
    return best?{externalId:best.id,distance:best.distance,zOrder:'top',cursorStyle:'pointer',hitTestPriority:1}:null
  }
}
export class ParallelChannelPrimitive implements ISeriesPrimitive<Time>{
  chart:IChartApi|null=null
  series:ISeriesApi<SeriesType,Time>|null=null
  bars:BarTimeSeries=[]
  channels:readonly ParallelChannelDrawing[]=[]
  draft:Draft|null=null
  selectedId:string|null=null
  selectionEnabled=true
  hitBoost=1
  private requestUpdate:(()=>void)|null=null
  private view=new ChannelView(this)
  attached(p:SeriesAttachedParameter<Time,SeriesType>){this.chart=p.chart;this.series=p.series;this.requestUpdate=p.requestUpdate}
  detached(){this.chart=null;this.series=null;this.requestUpdate=null}
  setBars(v:BarTimeSeries){this.bars=v;this.requestUpdate?.()}
  setChannels(v:readonly ParallelChannelDrawing[]){this.channels=v;this.requestUpdate?.()}
  setDraft(v:Draft|null){this.draft=v;this.requestUpdate?.()}
  setSelectedId(v:string|null){this.selectedId=v;this.requestUpdate?.()}
  setSelectionEnabled(v:boolean){this.selectionEnabled=v}
  setHitBoost(v:number){this.hitBoost=v}
  updateAllViews(){this.view.update()}
  paneViews(){return [this.view]}
  getDrawing(id:string){return this.channels.find(v=>v.id===id)??null}
  hitTest(x:number,y:number){return this.selectionEnabled?this.view.hit({x,y}):null}
  anchorIndex(id:string,p:ScreenPoint){return this.selectionEnabled?this.view.anchor(id,p):-1}
}
