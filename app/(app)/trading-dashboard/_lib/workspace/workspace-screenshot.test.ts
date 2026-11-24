import assert from 'node:assert/strict'
import { test } from 'node:test'
import { relativeBounds, screenshotFilename } from './workspace-screenshot'
import { registerChartScreenshot,getChartScreenshot } from './chart-screenshot-source'
test('composes unequal pane sizes using actual grid-relative positions',()=>{assert.deepEqual(relativeBounds({left:210,top:72,width:180,height:240},{left:10,top:32,width:380,height:500}),{x:200,y:40,width:180,height:240})})
test('filename includes symbol, pane count and filesystem-safe UTC time',()=>{assert.equal(screenshotFilename('EURUSD',4,new Date('2026-11-24T12:00:00Z')),'EURUSD-4pane-2026-11-24T12-00-00-000Z.png')})
test('registration is scoped to host and old cleanup cannot remove replacement',()=>{const host={} as HTMLElement;const first={} as HTMLCanvasElement;const second={} as HTMLCanvasElement;const cleanup=registerChartScreenshot(host,()=>first);const latest=registerChartScreenshot(host,()=>second);cleanup();assert.equal(getChartScreenshot(host),second);latest();assert.equal(getChartScreenshot(host),null)})
