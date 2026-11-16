/** Coarse vs fine pointer classification shared by store and legacy composition paths. */

export function isCoarsePointerEvent(event: PointerEvent, pointerCoarse: boolean): boolean {
  return event.pointerType === 'touch' || pointerCoarse
}

/** Fine pointers follow the cursor for draft preview; coarse/touch use seed+drag. */
export function shapePreviewFollowsPointer(
  pointerCoarse: boolean,
  event?: PointerEvent,
): boolean {
  if (event) return !isCoarsePointerEvent(event, pointerCoarse)
  return !pointerCoarse
}
