import type { ReactNode } from 'react'
import type { WorkspaceLayoutMode } from '../../_lib/workspace/workspace-layout'

const layoutClasses: Record<WorkspaceLayoutMode, string> = {
  expanded: 'flex h-full min-h-0 overflow-hidden',
  focus: 'workspace-grid workspace-grid-two grid h-full min-h-0 min-w-0 overflow-hidden',
  four: 'workspace-grid workspace-grid-four grid h-full min-h-0 min-w-0 overflow-hidden',
}

export function WorkspaceLayout({ mode, children }: { mode: WorkspaceLayoutMode; children: ReactNode }) {
  return <div className={layoutClasses[mode]}>{children}</div>
}
