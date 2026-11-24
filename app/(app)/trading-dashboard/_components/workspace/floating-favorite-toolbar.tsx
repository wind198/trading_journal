'use client'
import { Button } from '@/components/ui/button'
import { MousePointer2, Star, X, Settings2 } from 'lucide-react'
import { FAVORITE_TOOL_CATALOG } from './drawing-tool-catalog'
import { favoriteMode, isFavoriteActive, type FavoriteTools } from '../../_lib/workspace/favorite-tools'
import type { DrawingControl, DrawingMode } from '../../_lib/workspace/drawing-control'

export function FloatingFavoriteToolbar({ favorites, control, onMode, onHide, onEdit }: {
  favorites: FavoriteTools; control: DrawingControl; onMode: (mode: DrawingMode) => void; onHide: () => void; onEdit: () => void
}) {
  if (!favorites.visible) return null
  return <div className="absolute inset-x-1 bottom-1 z-[25] flex justify-center pointer-events-none">
    <div role="group" aria-label={'Favorite drawing tools — ' + control.paneId.toUpperCase()} className="pointer-events-auto flex min-w-0 max-w-full items-center gap-0.5 rounded-md border bg-background shadow-md p-0.5">
      <Star className="ml-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <Button size="icon-sm" className="size-9 shrink-0" variant={control.mode.kind === 'idle' ? 'secondary' : 'ghost'} aria-label="Favorite cursor / cancel" title="Cursor / cancel" onClick={() => onMode({kind:'idle'})}><MousePointer2 /></Button>
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {favorites.tools.map(id => {
          const def = FAVORITE_TOOL_CATALOG.find(tool => tool.tool === id)
          if (!def) return null
          const Icon = def.icon
          const active = isFavoriteActive(control.mode, id)
          return <Button key={id} size="icon-sm" className="size-9 shrink-0" variant={active ? 'default' : 'ghost'} aria-label={'Favorite ' + def.label} aria-pressed={active} title={def.label} onClick={() => onMode(favoriteMode(id))}><Icon /></Button>
        })}
      </div>
      <Button size="icon-sm" className="size-9 shrink-0" variant="ghost" aria-label="Customize favorites" title="Customize favorites" onClick={onEdit}><Settings2 /></Button>
      <Button size="icon-sm" className="size-9 shrink-0" variant="ghost" aria-label="Hide favorites toolbar" title="Hide favorites toolbar" onClick={onHide}><X /></Button>
    </div>
  </div>
}
