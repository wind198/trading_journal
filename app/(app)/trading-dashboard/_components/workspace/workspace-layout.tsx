import type { CSSProperties, ReactNode, Ref } from 'react'
import type { PaneId, WorkspaceLayoutMode } from '../../_lib/workspace/workspace-layout'
import { portraitTracks, splitTracks, type LayoutPreferences } from '../../_lib/workspace/layout-preferences'

const layoutClasses: Record<WorkspaceLayoutMode, string> = {
  expanded: 'flex h-full min-h-0 overflow-hidden',
  focus: 'workspace-grid workspace-grid-two grid h-full min-h-0 min-w-0 overflow-hidden',
  four: 'workspace-grid workspace-grid-four grid h-full min-h-0 min-w-0 overflow-hidden',
}

export function WorkspaceLayout({ mode, preferences, children, captureRef, expanded }: { mode: WorkspaceLayoutMode; preferences: LayoutPreferences; children: ReactNode; captureRef?: Ref<HTMLDivElement>; expanded?: PaneId | null }) {
  const style = {
    '--workspace-portrait-four': portraitTracks(preferences.fourPortrait),
    '--workspace-portrait-two': splitTracks(preferences.focusPortrait),
    '--workspace-wide-rows': splitTracks(preferences.fourWide.row),
    '--workspace-wide-columns': splitTracks(preferences.fourWide.column),
    '--workspace-wide-focus': splitTracks(preferences.focusWide),
  } as CSSProperties
  return <div ref={captureRef} data-workspace-expanded={expanded ?? undefined} className={'relative isolate z-0 ' + layoutClasses[mode]} style={style}>{children}</div>
}
