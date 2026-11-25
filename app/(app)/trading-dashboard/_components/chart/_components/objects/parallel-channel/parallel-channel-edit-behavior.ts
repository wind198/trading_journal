import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
import type { ToolEditBehavior,ToolEditSession,ScreenPoint } from '../../../_sessions/edit/edit-contract'
import type { ParallelChannelPrimitive } from './parallel-channel-primitive'
import { moveChannel } from './parallel-channel-geometry'
export class ParallelChannelEditBehavior implements ToolEditBehavior {
  constructor(private primitive:ParallelChannelPrimitive){}
  beginPrimary(id:string,screen:ScreenPoint,origin:DrawingPoint|null):ToolEditSession|null{
    const drawing=this.primitive.getDrawing(id)
    if(!drawing||!origin)return null
    const vertex=this.primitive.anchorIndex(id,screen)
    if(vertex<0&&this.primitive.hitTest(screen.x,screen.y)?.externalId!==id)return null
    const start=origin
    const anchor=vertex<0?undefined:drawing.points[vertex]
    return {id,changeKind:'polyline',relativeAnchor:anchor,move:point=>({kind:'polyline',id,points:moveChannel(drawing.points,vertex,start,point)})}
  }
}
