import assert from 'node:assert/strict'
import test from 'node:test'
import { createChartCreateRuntime } from './chart-create-runtime'

const p1 = { time: 10, price: 1 }
const p2 = { time: 20, price: 2 }
const p3 = { time: 30, price: 1.5 }

function ports() {
  const completed: unknown[] = []
  const previews: unknown[] = []
  const scheduled: unknown[] = []
  const polyline: unknown[] = []
  return {
    completed,
    previews,
    scheduled,
    polyline,
    api: {
      mapPoint: (screen: { x: number; y: number }) =>
        (screen.x < 0 ? null : screen.x < 15 ? p1 : screen.x < 25 ? p2 : p3),
      preview: (_id: string, a: typeof p1, b?: typeof p2 | null, c?: typeof p3 | null) => {
        previews.push({ p1: a, p2: b, p3: c })
      },
      schedulePreview: (_id: string, a: typeof p1, b?: typeof p2 | null, c?: typeof p3 | null) => {
        scheduled.push({ p1: a, p2: b, p3: c })
      },
      clearPreview: () => {},
      discardScheduledPreview: () => {},
      complete: (drawing: unknown) => completed.push(drawing),
      polylinePreview: (points: unknown, hover?: unknown) => polyline.push({ points, hover }),
      polylineComplete: (points: unknown) => completed.push({ kind: 'polyline', points }),
      defaultSecondPoint: (anchor: typeof p1) => ({ time: anchor.time + 1, price: anchor.price + 1 }),
      defaultThirdPoint: (a: typeof p1, b: typeof p2) => ({
        time: b.time + 1,
        price: (a.price + b.price) / 2,
      }),
      viewportCenter: () => p1,
    },
  }
}

test('runtime routes fine two-point tools through one InteractionStore', () => {
  const p = ports()
  const runtime = createChartCreateRuntime(p.api)
  runtime.tap('trendline', { x: 10, y: 0 })
  assert.equal(runtime.placing('trendline'), true)
  runtime.hover('trendline', { x: 20, y: 0 })
  runtime.tap('trendline', { x: 20, y: 0 })
  assert.deepEqual(p.completed, [{ kind: 'trendline', p1, p2 }])
  runtime.dispose()
})

test('runtime coarse two-point seed confirm completes', () => {
  const p = ports()
  const runtime = createChartCreateRuntime(p.api)
  assert.equal(runtime.seedCoarse('rectangle'), true)
  assert.equal(runtime.isCoarsePlacing('rectangle'), true)
  runtime.confirmCoarse('rectangle')
  runtime.confirmCoarse('rectangle')
  assert.deepEqual(p.completed, [{
    kind: 'rectangle',
    p1,
    p2: { time: 11, price: 2 },
  }])
  runtime.dispose()
})

test('runtime fine extension completes on third tap', () => {
  const p = ports()
  const runtime = createChartCreateRuntime(p.api)
  runtime.tap('fibonacci_range_extension', { x: 10, y: 0 })
  runtime.tap('fibonacci_range_extension', { x: 20, y: 0 })
  runtime.tap('fibonacci_range_extension', { x: 30, y: 0 })
  assert.deepEqual(p.completed, [{
    kind: 'fibonacci_range_extension',
    p1,
    p2: p3,
    points: [p1, p2, p3],
  }])
  runtime.dispose()
})

test('runtime one-shot icon completes on first tap', () => {
  const p = ports()
  const runtime = createChartCreateRuntime(p.api)
  runtime.tap('icon_strong_push_up', { x: 10, y: 0 })
  assert.deepEqual(p.completed, [{ kind: 'icon_strong_push_up', p1, p2: p1 }])
  runtime.dispose()
})

test('text follows laptop cursor, commits once on click', () => {
  const p=ports(); const runtime=createChartCreateRuntime(p.api)
  runtime.hover('text_anchor',{x:10,y:0})
  runtime.hover('text_anchor',{x:20,y:0})
  assert.equal(p.completed.length,0)
  runtime.tap('text_anchor',{x:20,y:0})
  assert.deepEqual(p.completed,[{kind:'text_anchor',p1:p2,p2}])
  runtime.dispose()
})
test('touch text seeds, moves, confirms one anchor', () => {
  const p=ports();const runtime=createChartCreateRuntime(p.api)
  assert.equal(runtime.seedCoarse('text_anchor'),true)
  assert.equal(runtime.isCoarsePlacing('text_anchor'),true)
  runtime.moveCoarse('text_anchor',p3)
  assert.deepEqual(runtime.activeAnchor('text_anchor'),p3)
  runtime.confirmCoarse('text_anchor')
  assert.deepEqual(p.completed,[{kind:'text_anchor',p1:p3,p2:p3}])
  runtime.dispose()
})
test('cancelled text draft does not persist', () => {
  const p=ports();const runtime=createChartCreateRuntime(p.api)
  runtime.seedCoarse('text_anchor');runtime.cancel()
  assert.equal(runtime.placing('text_anchor'),false)
  assert.equal(p.completed.length,0)
  runtime.dispose()
})

test('parallel channel uses three fine anchors and persists one object',()=>{const p=ports();const runtime=createChartCreateRuntime(p.api);runtime.tap('parallel_channel',{x:10,y:0});runtime.tap('parallel_channel',{x:20,y:0});runtime.tap('parallel_channel',{x:30,y:0});assert.deepEqual(p.completed,[{kind:'parallel_channel',p1,p2:p3,points:[p1,p2,p3]}]);runtime.dispose()})
test('parallel channel uses coarse seed and three confirmations',()=>{const p=ports();const runtime=createChartCreateRuntime(p.api);assert.equal(runtime.seedCoarse('parallel_channel'),true);runtime.confirmCoarse('parallel_channel');runtime.confirmCoarse('parallel_channel');runtime.confirmCoarse('parallel_channel');assert.equal(p.completed.length,1);runtime.dispose()})
