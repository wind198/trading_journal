import type { KeyLevelZone } from './baseline-indicators'

export function keyLevelZoneStyle(type: KeyLevelZone['type']): {
  fill: string
  border: string
} {
  return type === 'Boundary'
    ? { fill: 'rgba(251, 191, 36, 0.20)', border: '#fbbf24' }
    : { fill: 'rgba(96, 165, 250, 0.18)', border: '#60a5fa' }
}
