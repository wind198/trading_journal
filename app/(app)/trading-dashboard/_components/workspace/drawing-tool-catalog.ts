import { Pencil, TrendingUp, Square, Circle, Spline, Type, Ruler, AlignLeft, ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, TrendingDown } from 'lucide-react'
import { CHART_ICON_DEFINITIONS } from '../../_lib/chart/chart-icons'
import type { FavoriteToolId } from '../../_lib/workspace/favorite-tools'
export const TOOLS = [
  { tool: 'trendline', label: 'Trend line', icon: TrendingUp },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'fibonacci_range', label: 'Fibonacci range', icon: AlignLeft },
  { tool: 'fibonacci_range_extension', label: 'Fibonacci extension', icon: AlignLeft },
  { tool: 'warning_circle', label: 'Warning circle', icon: Circle },
  { tool: 'polyline_arrow', label: 'Polyline arrow', icon: Spline },
  { tool: 'text_anchor', label: 'Text anchor', icon: Type },
] as const satisfies readonly { tool: FavoriteToolId; label: string; icon: typeof Pencil }[]


export const FAVORITE_TOOL_CATALOG = [
  ...TOOLS,
  { tool: 'measure' as const, label: 'Measure', icon: Ruler },
  ...CHART_ICON_DEFINITIONS.map(def => ({ tool: def.kind as FavoriteToolId, label: def.label, icon: def.family === 'strong_push' ? (def.direction === 'up' ? ArrowUp : ArrowDown) : def.family === 'weakening_trend' ? (def.direction === 'up' ? TrendingUp : TrendingDown) : def.family === 'weak_reaction' ? (def.direction === 'up' ? ChevronUp : ChevronDown) : (def.direction === 'up' ? ArrowUpRight : ArrowDownRight) })),
]
