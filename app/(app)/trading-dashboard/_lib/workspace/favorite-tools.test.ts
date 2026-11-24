import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_FAVORITES, normalizeFavorites, toggleFavorite, favoriteMode, isFavoriteActive } from './favorite-tools'
test('invalid storage falls back and unknown or duplicate tools are discarded', () => {
  assert.deepEqual(normalizeFavorites(null), DEFAULT_FAVORITES)
  assert.deepEqual(normalizeFavorites({visible:true,tools:['rectangle','rectangle','unknown','measure']}), {visible:true,tools:['rectangle','measure']})
})
test('empty favorites and visibility persist', () => assert.deepEqual(normalizeFavorites({visible:false,tools:[]}), {visible:false,tools:[]}))
test('toggle adds in order and removes without changing visibility', () => {
  const current = {visible:true,tools:[]}
  const next = toggleFavorite(toggleFavorite(current,'measure'),'rectangle')
  assert.deepEqual(next,{visible:true,tools:['measure','rectangle']})
  assert.deepEqual(toggleFavorite(next,'measure'),{visible:true,tools:['rectangle']})
})
test('favorite modes use existing workspace drawing semantics', () => {
  assert.deepEqual(favoriteMode('measure'),{kind:'measure'})
  assert.equal(isFavoriteActive(favoriteMode('rectangle'),'rectangle'),true)
  assert.equal(isFavoriteActive(favoriteMode('rectangle'),'trendline'),false)
})
