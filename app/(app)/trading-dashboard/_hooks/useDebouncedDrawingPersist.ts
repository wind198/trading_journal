'use client'

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { useDebounceCallback } from 'usehooks-ts'
import { toast } from 'sonner'
import {
  loadChartDrawings,
  updateChartDrawing,
  updatePolylineArrow,
  type ChartDrawing,
  type DrawingPoint,
} from '../_lib/chart/chart-drawings'

const DRAWING_UPDATE_DEBOUNCE_MS = 400
const SYMBOL = 'EURUSD'

export function useDebouncedDrawingPersist(
  timeframe: string,
  setDrawings: Dispatch<SetStateAction<ChartDrawing[]>>,
) {
  const pendingRef = useRef<Record<string, { p1: DrawingPoint; p2: DrawingPoint }>>({})
  const polylinePendingRef = useRef<Record<string, DrawingPoint[]>>({})

  const persistOne = useCallback(
    (id: string, points: { p1: DrawingPoint; p2: DrawingPoint }) => {
      delete pendingRef.current[id]
      void updateChartDrawing(id, points).catch(() => {
        toast.error('Failed to save drawing')
        void loadChartDrawings(SYMBOL, timeframe)
          .then((rows) => setDrawings(rows))
          .catch(() => {})
      })
    },
    [timeframe, setDrawings],
  )

  const persistPolylineOne = useCallback(
    (id: string, points: DrawingPoint[]) => {
      delete polylinePendingRef.current[id]
      void updatePolylineArrow(id, { points }).catch(() => {
        toast.error('Failed to save polyline')
        void loadChartDrawings(SYMBOL, timeframe)
          .then((rows) => setDrawings(rows))
          .catch(() => {})
      })
    },
    [timeframe, setDrawings],
  )

  const flushAll = useCallback(() => {
    const pending = { ...pendingRef.current }
    for (const [id, points] of Object.entries(pending)) {
      persistOne(id, points)
    }
    const polyPending = { ...polylinePendingRef.current }
    for (const [id, points] of Object.entries(polyPending)) {
      persistPolylineOne(id, points)
    }
  }, [persistOne, persistPolylineOne])

  const debouncedFlushAll = useDebounceCallback(flushAll, DRAWING_UPDATE_DEBOUNCE_MS)

  const queuePersist = useCallback(
    (id: string, p1: DrawingPoint, p2: DrawingPoint) => {
      if (id.startsWith('temp-')) return
      pendingRef.current[id] = { p1, p2 }
      debouncedFlushAll()
    },
    [debouncedFlushAll],
  )

  const commitPersist = useCallback(
    (id: string) => {
      if (id.startsWith('temp-')) return
      const points = pendingRef.current[id]
      if (!points) return
      debouncedFlushAll.cancel()
      persistOne(id, points)
      if (Object.keys(pendingRef.current).length > 0) {
        debouncedFlushAll()
      }
    },
    [debouncedFlushAll, persistOne],
  )

  const queuePolylinePersist = useCallback(
    (id: string, points: DrawingPoint[]) => {
      if (id.startsWith('temp-')) return
      polylinePendingRef.current[id] = points
      debouncedFlushAll()
    },
    [debouncedFlushAll],
  )

  const commitPolylinePersist = useCallback(
    (id: string) => {
      if (id.startsWith('temp-')) return
      const points = polylinePendingRef.current[id]
      if (!points) return
      debouncedFlushAll.cancel()
      persistPolylineOne(id, points)
      if (
        Object.keys(pendingRef.current).length > 0 ||
        Object.keys(polylinePendingRef.current).length > 0
      ) {
        debouncedFlushAll()
      }
    },
    [debouncedFlushAll, persistPolylineOne],
  )

  return { queuePersist, commitPersist, queuePolylinePersist, commitPolylinePersist }
}
