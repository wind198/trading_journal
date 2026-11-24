import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type { IChartApi, ISeriesApi, ISeriesPrimitive, PrimitiveHoveredItem, SeriesAttachedParameter, SeriesType, Time } from 'lightweight-charts'
import { chartXAtTime, type BarTimeSeries } from '../../../../../_lib/chart/chart-coordinates'
import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
import { channelGeometry, type ChannelPoints } from './parallel-channel-geometry'

export type ParallelChannelDrawing = { id: string; points: ChannelPoints }
type Pixel = { x:number; y:number }
type Draft = {p1:DrawingPoint;p2?:DrawingPoint;p3?:DrawingPoint}
type ScreenChannel = { id:string; anchors:Pixel[]; lines:Pixel[][]; draft:boolean; selected:boolean }
function distance(p:Pixel,a:Pixel,b:Pixel) {
  const dx=b.x-a.x,dy=b.y-a.y
  const t=dx||dy?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))):0
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)
}
class ChannelView {
  private channels: ScreenChannel[]=[]
  constructor(private source: ParallelChannelPrimitive) {}
  zOrder(): 'bottom' { return 'bottom' }
  update() {
    const source=this.source
    const project=(p:DrawingPoint):Pixel|null=>{
      if(!source.chart||!source.series)return null
      const x=chartXAtTime(source.chart,p.time,source.bars),y=source.series.priceToCoordinate(p.price)
      return x==null||y==null?null:{x:Number(x),y:Number(y)}
    }
    const build=(id:string, points:DrawingPoint[], draft:boolean)=>{
      const anchors=points.map(project)
      if(anchors.some(p=>p===null))return
      let lines:Pixel[][]=[]
      if(points.length===3){
        const geometry=channelGeometry(points as ChannelPoints)
        if(geometry) lines=[geometry.baseline,geometry.opposite,geometry.middle].map(line=>line.map(project)).filter(line=>line.every(p=>p!==null)) as Pixel[][]
      } else if(anchors.length===2) lines=[anchors as Pixel[]]
      return {id,anchors:anchors as Pixel[],lines,draft,selected:source.selectedId===id}
    }
    this.channels=source.channels.map(d=>build(d.id,d.points,false)).filter((d):d is ScreenChannel=>!!d)
    if(source.draft){const {p1,p2,p3}=source.draft;const d=build('draft',[p1,...(p2?[p2]:[]),...(p3?[p3]:[])],true);if(d)this.channels.push(d)}
  }
  renderer(){return {draw:(target:CanvasRenderingTarget2D)=>target.useMediaCoordinateSpace(({context:ctx})=>{
    for(const c of this.channels){
      ctx.save()
      const color=c.selected?'#F0AD4E':'#3564D8'
      if(c.lines.length===3){
        const [a,b]=c.lines[0], [d,e]=c.lines[1]
        ctx.fillStyle=c.draft?'rgba(53,100,216,.06)':'rgba(53,100,216,.10)'
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(e.x,e.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill()
      }
      ctx.strokeStyle=color;ctx.lineWidth=c.selected?1.8:1.2
      c.lines.forEach((line,i)=>{ctx.setLineDash(c.draft||i===2?[5,4]:[]);ctx.beginPath();ctx.moveTo(line[0].x,line[0].y);ctx.lineTo(line[1].x,line[1].y);ctx.stroke()})
      if(c.selected||c.draft){ctx.setLineDash([]);ctx.fillStyle=color;for(const p of c.anchors){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill()}}
      ctx.restore()
    }
  })}}
  hitTest(x:number,y:number):PrimitiveHoveredItem|null{
    let best:{id:string;distance:number}|null=null
    for(const c of this.channels){if(c.draft)continue;const d=Math.min(...c.lines.map(line=>distance({x,y},line[0],line[1])));if(d<=6*this.source.hitBoost&&(!best||d<best.distance))best={id:c.id,distance:d}}
    return best?{externalId:best.id,zOrder:'bottom',cursorStyle:'pointer',distance:best.distance,hitTestPriority:1}:null
  }
  hitAnchor(x:number,y:number){for(const c of this.channels){if(!c.selected||c.draft)continue;const vertexIndex=c.anchors.findIndex(p=>Math.hypot(p.x-x,p.y-y)<=8*this.source.hitBoost);if(vertexIndex>=0)return {id:c.id,vertexIndex}}return null}
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
  private views=[this.view]
  setChannels(v:readonly ParallelChannelDrawing[]){this.channels=v;this.requestUpdate?.()}
  setBars(v:BarTimeSeries){this.bars=v;this.requestUpdate?.()}
  setDraft(v:Draft|null){this.draft=v;this.requestUpdate?.()}
  setSelectedId(v:string|null){this.selectedId=v;this.requestUpdate?.()}
  setSelectionEnabled(v:boolean){this.selectionEnabled=v}
  setHitBoost(v:number){this.hitBoost=v;this.requestUpdate?.()}
  attached(p:SeriesAttachedParameter<Time,SeriesType>){this.chart=p.chart;this.series=p.series;this.requestUpdate=p.requestUpdate}
  detached(){this.chart=null;this.series=null;this.requestUpdate=null}
  updateAllViews(){this.view.update()}
  paneViews(){return this.views}
  hitTest(x:number,y:number){return this.selectionEnabled?this.view.hitTest(x,y):null}
  hitTestAnchor(x:number,y:number){return this.selectionEnabled?this.view.hitAnchor(x,y):null}
  getDrawing(id:string){return this.channels.find(d=>d.id===id)??null}
}
