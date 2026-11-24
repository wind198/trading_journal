import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_INSPECTOR, toggleInspector, showInspector } from './inspector-state'
test('inspector starts closed', () => assert.equal(DEFAULT_INSPECTOR.open, false))
test('toggle preserves last tab', () => assert.deepEqual(toggleInspector({open:true,tab:'alerts'}), {open:false,tab:'alerts'}))
test('selecting a tab replaces the existing tab', () => assert.deepEqual(showInspector({open:true,tab:'notes'}, 'indicators'), {open:true,tab:'indicators'}))
