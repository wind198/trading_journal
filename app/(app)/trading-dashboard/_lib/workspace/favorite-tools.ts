import type { ChartDrawingKind } from '../chart/chart-drawings'
import type { DrawingMode } from './drawing-control'

export const FAVORITE_TOOL_IDS = [
  'measure', 'parallel_channel', 'trendline', 'rectangle', 'fibonacci_range', 'fibonacci_range_extension',
  'warning_circle', 'polyline_arrow', 'text_anchor',
  'icon_strong_push_up', 'icon_strong_push_down', 'icon_weakening_trend_up', 'icon_weakening_trend_down',
  'icon_weak_reaction_up', 'icon_weak_reaction_down', 'icon_resistance_test_up', 'icon_resistance_test_down',
] as const satisfies readonly ('measure' | ChartDrawingKind)[]
export type FavoriteToolId = typeof FAVORITE_TOOL_IDS[number]
export type FavoriteTools = { visible: boolean; tools: FavoriteToolId[] }
export const FAVORITES_STORAGE_KEY = 'trading-workspace.favorite-tools:v1'
export const DEFAULT_FAVORITES: FavoriteTools = { visible: false, tools: ['trendline', 'rectangle', 'fibonacci_range', 'measure'] }
export function normalizeFavorites(raw: unknown): FavoriteTools {
  if (!raw || typeof raw !== 'object') return DEFAULT_FAVORITES
  const value = raw as Partial<FavoriteTools>
  return {
    visible: typeof value.visible === 'boolean' ? value.visible : DEFAULT_FAVORITES.visible,
    tools: Array.isArray(value.tools) ? [...new Set(value.tools.filter((id): id is FavoriteToolId => FAVORITE_TOOL_IDS.includes(id)))] : [...DEFAULT_FAVORITES.tools],
  }
}
export function toggleFavorite(current: FavoriteTools, id: FavoriteToolId): FavoriteTools {
  return { ...current, tools: current.tools.includes(id) ? current.tools.filter(tool => tool !== id) : [...current.tools, id] }
}
export function favoriteMode(id: FavoriteToolId): DrawingMode {
  return id === 'measure' ? { kind: 'measure' } : { kind: 'draw', tool: id }
}
export function isFavoriteActive(mode: DrawingMode, id: FavoriteToolId): boolean {
  return id === 'measure' ? mode.kind === 'measure' : mode.kind === 'draw' && mode.tool === id
}
