import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
import type { ScreenPoint, ToolEditBehavior, ToolEditSession } from '../../../_sessions/edit/edit-contract'
import type { ParallelChannelPrimitive } from './parallel-channel-primitive'
import { moveChannel } from './parallel-channel-geometry'
export class ParallelChannelEditBehavior implements ToolEditBehavior {
  constructor(private primitive:ParallelChannelPrimitive){}
  beginPrimary(id:string,screen:ScreenPoint,chartPoint:DrawingPoint|null):ToolEditSession|null{
    const drawing=this.primitive.getDrawing(id)
    if(!drawing||!chartPoint)return null
    const anchor=this.primitive.hitTestAnchor(screen.x,screen.y)
    if(anchor?.id!==id&&this.primitive.hitTest(screen.x,screen.y)?.externalId!==id)return null
    const vertex=anchor?.id===id?anchor.vertexIndex:-1
    return {id,changeKind:'polyline',move(point){return {kind:'polyline',id,points:moveChannel(drawing.points,vertex,chartPoint,point)}}}
  }
}
