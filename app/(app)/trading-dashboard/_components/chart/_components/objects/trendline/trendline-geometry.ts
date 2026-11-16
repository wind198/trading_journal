/** Screen-space segment for a trendline: line tips are the stored anchors (no ray extension). */
export function trendlineScreenSegment(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  return {
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    mx1: p1.x,
    my1: p1.y,
    mx2: p2.x,
    my2: p2.y,
  }
}
