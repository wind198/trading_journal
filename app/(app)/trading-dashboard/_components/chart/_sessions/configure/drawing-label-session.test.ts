import assert from 'node:assert/strict'
import test from 'node:test'
import { DrawingLabelSession } from './drawing-label-session'

test('label draft saves once and closes before the host persists it', () => {
  const session = new DrawingLabelSession()
  session.open({ id: 'a', kind: 'text_anchor', label: 'Before' })
  session.changeDraft('After')
  assert.deepEqual(session.save(), { id: 'a', kind: 'text_anchor', label: 'After' })
  assert.deepEqual(session.state, { status: 'closed' })
  assert.equal(session.save(), null)
})

test('cancel discards the draft and reopening starts from the supplied label', () => {
  const session = new DrawingLabelSession()
  session.open({ id: 'a', kind: 'warning_circle', label: 'Before' })
  session.changeDraft('Unsaved')
  session.cancel()
  session.open({ id: 'a', kind: 'warning_circle', label: 'Before' })
  assert.deepEqual(session.state, { status: 'editing', id: 'a', kind: 'warning_circle', original: 'Before', draft: 'Before' })
})
