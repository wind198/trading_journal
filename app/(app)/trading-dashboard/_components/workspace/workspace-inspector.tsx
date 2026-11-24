'use client'
import { useEffect, useRef } from 'react'
import { Tabs } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { X, ChartNoAxesCombined, NotebookPen, Settings2, Bell, BookOpen } from 'lucide-react'
import { NotesSidebar } from '../notes/notes-sidebar'
import { GuidesSidebar } from '../guides/guides-sidebar'
import { IndicatorSettingsPanel, AlertSettingsPanel, type ChartOverlaySettingsMenuProps } from '../dashboard/chart-overlay-settings-menu'
import { PANES, SYMBOL, type PaneId } from '../../_lib/workspace/workspace-layout'
import type { InspectorTab } from '../../_lib/workspace/inspector-state'

const tabs = [
  { id: 'market', label: 'Market', icon: ChartNoAxesCombined },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'indicators', label: 'Indicators', icon: Settings2 },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'guides', label: 'Guides', icon: BookOpen },
] as const

export function WorkspaceInspector({ open, tab, onTab, onClose, activePane, settings, autoRegimesByPane, onSettingsChange, alertConfig }: ChartOverlaySettingsMenuProps & {
  open: boolean; tab: InspectorTab; onTab: (tab: InspectorTab) => void; onClose: () => void; activePane: PaneId
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => { previousFocus.current?.focus() }
  }, [open])
  return (
    <aside hidden={!open} aria-label="Workspace inspector" id="workspace-inspector"
      className={open ? "absolute inset-y-0 right-0 z-30 flex w-80 max-w-full flex-col border-l bg-background shadow-lg" : "hidden"}
      onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); onClose() } }}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-2">
        <span className="text-xs font-semibold">Inspector · {activePane.toUpperCase()}</span>
        <Button ref={closeRef} variant="ghost" size="icon-sm" aria-label="Close inspector" onClick={onClose}><X /></Button>
      </div>
      <Tabs.Root value={tab} onValueChange={value => onTab(value as InspectorTab)} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="grid shrink-0 grid-cols-5 border-b" aria-label="Inspector sections">
          {tabs.map(({id, label, icon: Icon}) => <Tabs.Trigger key={id} value={id} title={label} aria-label={label}
            className="flex h-10 flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-primary">
            <Icon className="size-4" aria-hidden />{label}
          </Tabs.Trigger>)}
        </Tabs.List>
        <Tabs.Content value="market" className="min-h-0 flex-1 overflow-y-auto p-3">
          <h3 className="text-sm font-semibold">{SYMBOL} · Market regime</h3>
          <div className="mt-2 divide-y">
            {PANES.map(pane => <div key={pane.id} className="flex items-center justify-between py-2 text-xs">
              <span className={pane.id === activePane ? 'font-semibold text-primary' : ''}>{pane.label.toUpperCase()}</span>
              <span>{autoRegimesByPane[pane.id] ?? 'Unavailable'}</span>
            </div>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Regime from loaded chart data. Hidden panes may be unavailable.</p>
        </Tabs.Content>
        <Tabs.Content value="notes" forceMount className="min-h-0 flex-1 flex-col data-[state=active]:flex data-[state=inactive]:hidden">
          <NotesSidebar symbol={SYMBOL} embedded onClose={onClose} />
        </Tabs.Content>
        <Tabs.Content value="indicators" className="min-h-0 flex-1 overflow-y-auto">
          <IndicatorSettingsPanel settings={settings} autoRegimesByPane={autoRegimesByPane} onSettingsChange={onSettingsChange} />
        </Tabs.Content>
        <Tabs.Content value="alerts" className="min-h-0 flex-1 overflow-y-auto"><AlertSettingsPanel alertConfig={alertConfig} /></Tabs.Content>
        <Tabs.Content value="guides" className="min-h-0 flex-1 flex flex-col"><GuidesSidebar embedded onClose={onClose} /></Tabs.Content>
      </Tabs.Root>
    </aside>
  )
}
