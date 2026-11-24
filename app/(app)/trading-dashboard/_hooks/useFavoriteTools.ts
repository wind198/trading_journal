'use client'
import { useLocalStorage } from 'usehooks-ts'
import { DEFAULT_FAVORITES, FAVORITES_STORAGE_KEY, normalizeFavorites, type FavoriteTools } from '../_lib/workspace/favorite-tools'
export function useFavoriteTools() {
  return useLocalStorage<FavoriteTools>(FAVORITES_STORAGE_KEY, DEFAULT_FAVORITES, {
    initializeWithValue: false,
    deserializer: raw => {
      try { return normalizeFavorites(JSON.parse(raw)) } catch { return DEFAULT_FAVORITES }
    },
  })
}
