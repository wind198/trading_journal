'use client'
import { useLocalStorage } from 'usehooks-ts'
import { DEFAULT_LAYOUT, LAYOUT_STORAGE_KEY, normalizeLayout, type LayoutPreferences } from '../_lib/workspace/layout-preferences'

export function useWorkspaceLayoutPreferences() {
  return useLocalStorage<LayoutPreferences>(LAYOUT_STORAGE_KEY, DEFAULT_LAYOUT, {
    initializeWithValue: false,
    deserializer: raw => {
      try { return normalizeLayout(JSON.parse(raw)) } catch { return DEFAULT_LAYOUT }
    },
  })
}
