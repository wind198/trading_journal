export type PriceMeasurementPoint = {
  x: number
  price: number
}

export type PriceMeasurementState =
  | { status: 'idle' }
  | { status: 'armed'; pointer: 'fine' }
  | {
      status: 'placing'
      pointer: 'fine'
      start: PriceMeasurementPoint
      end: PriceMeasurementPoint
    }
  | {
      status: 'placing'
      pointer: 'coarse'
      phase: 'placing_p1' | 'placing_p2'
      start: PriceMeasurementPoint
      end: PriceMeasurementPoint
    }
  | {
      status: 'complete'
      start: PriceMeasurementPoint
      end: PriceMeasurementPoint
    }

export type PriceMeasurementEvent =
  | { type: 'move'; point: PriceMeasurementPoint }
  | { type: 'confirm'; point: PriceMeasurementPoint }
  | { type: 'dismiss' }
  | { type: 'cancel' }

function isValidPoint(point: PriceMeasurementPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.price) && point.price > 0
}

function signed(value: number, digits: number): string {
  const fixed = value.toFixed(digits)
  return value > 0 ? `+${fixed}` : fixed
}

export function formatPriceMeasurement(startPrice: number, endPrice: number): string | null {
  if (!Number.isFinite(startPrice) || !Number.isFinite(endPrice) || startPrice <= 0) return null
  const delta = endPrice - startPrice
  const pips = delta / 0.0001
  const percent = (delta / startPrice) * 100
  if (![delta, pips, percent].every(Number.isFinite)) return null
  return `${signed(delta, 5)} · ${signed(pips, 1)} pips · ${signed(percent, 2)}%`
}

export function reducePriceMeasurement(
  state: PriceMeasurementState,
  event: PriceMeasurementEvent,
): PriceMeasurementState {
  if (event.type === 'cancel' || event.type === 'dismiss') return { status: 'idle' }
  if (!isValidPoint(event.point)) return state
  if (state.status === 'idle' || state.status === 'complete') return state

  if (state.status === 'armed') {
    if (event.type !== 'confirm') return state
    return { status: 'placing', pointer: 'fine', start: event.point, end: event.point }
  }

  if (event.type === 'move') {
    if (state.pointer === 'fine' || state.phase === 'placing_p2') {
      return { ...state, end: event.point }
    }
    return { ...state, start: event.point, end: event.point }
  }

  if (state.pointer === 'fine') {
    return { status: 'complete', start: state.start, end: event.point }
  }
  if (state.phase === 'placing_p1') {
    return {
      status: 'placing',
      pointer: 'coarse',
      phase: 'placing_p2',
      start: state.start,
      end: event.point,
    }
  }
  return { status: 'complete', start: state.start, end: state.end }
}
