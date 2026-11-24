'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { FAVORITE_TOOL_CATALOG } from './drawing-tool-catalog'
import type { FavoriteTools, FavoriteToolId } from '../../_lib/workspace/favorite-tools'

export function FavoriteToolsDialog({ open, onOpenChange, favorites, onToggle }: {
  open: boolean; onOpenChange: (open: boolean) => void; favorites: FavoriteTools; onToggle: (id: FavoriteToolId) => void
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-sm">
      <DialogHeader><DialogTitle>Favorite drawing tools</DialogTitle><DialogDescription>Select tools for the floating toolbar. Changes save automatically.</DialogDescription></DialogHeader>
      <div className="grid gap-1">
        {FAVORITE_TOOL_CATALOG.map(({tool, label, icon: Icon}) => <label key={tool} className="flex min-h-9 items-center gap-2 rounded px-1 text-sm">
          <Checkbox checked={favorites.tools.includes(tool)} onCheckedChange={() => onToggle(tool)} aria-label={'Favorite ' + label} />
          <Icon className="size-4" aria-hidden />{label}
        </label>)}
      </div>
    </DialogContent>
  </Dialog>
}
