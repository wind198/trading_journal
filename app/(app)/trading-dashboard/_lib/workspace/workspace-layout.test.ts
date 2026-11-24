import assert from 'node:assert/strict'
import { test } from 'node:test'
import { visibleWorkspacePanes, workspaceLayoutMode } from './workspace-layout'

test('four-chart mode preserves higher-to-lower timeframe order', () => {
  assert.deepEqual(visibleWorkspacePanes(null, false).map(p => p.id), ['4h', '1h', '15m', '3m'])
  assert.equal(workspaceLayoutMode(null, false), 'four')
})

test('focus mode keeps both execution timeframes', () => {
  assert.deepEqual(visibleWorkspacePanes(null, true).map(p => p.id), ['15m', '3m'])
  assert.equal(workspaceLayoutMode(null, true), 'focus')
})

test('expanded pane takes precedence over focus mode', () => {
  for (const focus of [true, false]) {
    assert.deepEqual(visibleWorkspacePanes('1h', focus).map(p => p.id), ['1h'])
    assert.equal(workspaceLayoutMode('1h', focus), 'expanded')
  }
})
