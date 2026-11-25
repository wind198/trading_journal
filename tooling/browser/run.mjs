import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = path.join(root, 'artifacts/browser')
const origin = 'http://127.0.0.1:4317'
const fakeSupabase = 'https://workspace-fixtures.invalid'
const env = {
  ...process.env,
  DISABLE_AUTH_ON_LOCALHOST: 'true',
  NEXT_PUBLIC_DISABLE_AUTH_ON_LOCALHOST: 'true',
  NEXT_PUBLIC_SUPABASE_URL: fakeSupabase,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-only-public-key',
}
try {
  await fetch(origin + '/login', {signal: AbortSignal.timeout(1000)})
  throw Error('Port 4317 is already serving HTTP; stop that server first')
} catch (error) {
  if (error.message.startsWith('Port 4317')) throw error
}
const server = spawn('pnpm', ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '4317'], { cwd: root, env, stdio: 'inherit' })
let browser
const report = []
const viewports = [
  { name: 'phone-small', width: 320, height: 568, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]
const intervals = { '3m': 300, '15m': 900, '1h': 3600, '4h': 14400 }
function candles(tf) {
  const interval = intervals[tf] ?? 300
  const end = Math.floor(Date.UTC(2026, 10, 23, 12) / 1000 / interval) * interval
  return Array.from({length: 240}, (_, i) => {
    const open = 1.08 + i * 0.00002 + Math.sin(i / 8) * 0.001
    const close = open + Math.cos(i / 3) * 0.00025
    return { time: end - (239-i)*interval, open, close, high: Math.max(open, close)+0.00015, low: Math.min(open, close)-0.00015 }
  })
}
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error('Fixture server exited')
    try { if ((await fetch(origin + '/login')).ok) return } catch {}
    await delay(1000)
  }
  throw Error('Fixture server did not become ready')
}
async function geometry(page, expected) {
  const sections = page.locator('section[data-chart-pane]:not([data-pane-obscured="true"])')
  await sections.first().waitFor({state:'visible'})
  assert.equal(await sections.count(), expected)
  await page.waitForFunction(n => [...document.querySelectorAll('section[data-chart-pane]:not([data-pane-obscured="true"])')].filter(el => el.querySelector('canvas')).length === n, expected)
  const bounds = await sections.evaluateAll(els => els.map(el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom} }))
  const viewport = page.viewportSize()
  for (const r of bounds) {
    assert.ok(r.width>0 && r.height>0 && r.x>=-1 && r.y>=-1 && r.right<=viewport.width+1 && r.bottom<=viewport.height+1, JSON.stringify(r))
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1))
  return bounds
}
async function click(page, name) {
  const target=page.getByRole('button',{name,exact:true})
  await target.click()
}
async function verifyInspectorClose(page, mobile) {
  const inspector=page.locator('#workspace-inspector')
  const opener=page.getByRole('button',{name:'Open inspector',exact:true})
  if(mobile) await opener.tap(); else await opener.click()
  await inspector.waitFor({state:'visible'})
  const close=inspector.getByRole('button',{name:'Close inspector',exact:true})
  const hit=await close.evaluate(el=>{
    const r=el.getBoundingClientRect()
    const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
    return {reachable:!!target&&el.contains(target),width:r.width,height:r.height}
  })
  assert.ok(hit.reachable,'Inspector close must win hit testing')
  if(mobile) {
    assert.ok(hit.width>=44&&hit.height>=44,'Touch close target must be at least 44px')
    await close.tap()
  } else await close.click()
  await inspector.waitFor({state:'hidden'})
  await opener.waitFor({state:'visible'})
}
async function setup(page) {
  await page.route('**/*', async route => {
    const url=new URL(route.request().url())
    if (url.origin===origin) {
      if (url.pathname.startsWith('/api/bars/')) {
        const data=candles(url.searchParams.get('timeframe'))
        return route.fulfill({json:{data:url.pathname.endsWith('/recent')?data.slice(-10):data}})
      }
      if(url.pathname==='/api/volume-profile') return route.fulfill({json:{data:{price:[],time:[]}}})
      if(url.pathname.startsWith('/api/')) return route.fulfill({status:404,json:{error:'Unmocked fixture API'}})
      return route.continue()
    }
    if (url.origin===fakeSupabase) {
      if(url.pathname.startsWith('/rest/v1/') && route.request().method()==='GET') return route.fulfill({json:[]})
      if(url.pathname==='/auth/v1/user') return route.fulfill({status:401,json:{message:'Fixture has no authenticated user'}})
    }
    return route.abort()
  })
}
try {
  await mkdir(output,{recursive:true})
  await waitForServer()
  browser=await chromium.launch()
  for(const v of viewports) {
    const context=await browser.newContext({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,hasTouch:v.mobile,isMobile:v.mobile})
    const page=await context.newPage()
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await setup(page)
    try {
      await page.goto(origin+'/trading-dashboard')
      const initial=await geometry(page,4)
      const canvasBefore = await page.locator('[data-chart-pane="4h"] canvas').first().elementHandle()
      const firstPane=page.locator('[data-chart-pane="4h"]')
      const expand=firstPane.getByRole('button',{name:'Expand window',exact:true})
      if(v.mobile) await expand.tap(); else await expand.click()
      await geometry(page,1)
      await verifyInspectorClose(page,v.mobile)
      assert.equal(await page.locator('section[data-chart-pane]').count(),4)
      assert.ok(await canvasBefore.evaluate(el=>el.isConnected), 'Expand must retain existing chart canvas')
      const collapse=firstPane.getByRole('button',{name:'Collapse window',exact:true})
      if(v.mobile) await collapse.tap(); else await collapse.click()
      await geometry(page,4)
      assert.ok(await canvasBefore.evaluate(el=>el.isConnected), 'Collapse must retain existing chart canvas')
      await click(page,'Chart layout and pane sizes')
      const layout=page.locator('[data-slot="popover-content"]')
      await layout.waitFor({state:'visible'})
      const outside=firstPane.getByRole('button',{name:'Activate 4h chart',exact:true})
      if(v.mobile) await outside.tap(); else await outside.click()
      await layout.waitFor({state:'hidden'})
      await page.screenshot({path:path.join(output,v.name+'-four.png')})
      await click(page,'Enter fullscreen')
      const full=await geometry(page,4)
      await verifyInspectorClose(page,v.mobile)
      const exit=page.getByRole('button',{name:'Exit fullscreen',exact:true})
      const rect=await exit.boundingBox()
      assert.ok(rect && rect.x>=0 && rect.x+rect.width<=v.width+1)
      await click(page,'Chart layout and pane sizes')
      await click(page,'2 charts')
      await page.keyboard.press('Escape')
      await geometry(page,2)
      await page.screenshot({path:path.join(output,v.name+'-focus-fullscreen.png')})
      await click(page,'Exit fullscreen')
      await page.reload()
      await geometry(page,2)
      await click(page,'Activate 3m chart')
      assert.equal(await page.locator('[data-chart-pane="3m"]').getAttribute('data-active-chart'),'true')
      await click(page,'Drawing tools — 3M')
      await page.getByRole('menuitem',{name:'Rectangle',exact:true}).click()
      await click(page,'Activate 15m chart')
      await page.getByRole('button',{name:'Drawing tools — 15M',exact:true}).waitFor()
      await click(page,'Open inspector')
      await page.getByRole('tab',{name:'Indicators'}).click()
      await page.getByRole('checkbox',{name:'Force candles on 15m'}).waitFor({state:'visible'})
      const closeInspector=page.locator('#workspace-inspector').getByRole('button',{name:'Close inspector',exact:true})
      if(v.mobile) await closeInspector.tap(); else await closeInspector.click()
      await page.locator('#workspace-inspector').waitFor({state:'hidden'})
      await page.getByRole('button',{name:'Open inspector'}).waitFor()
      assert.deepEqual(errors,[])
      report.push({viewport:v.name,status:'passed',initial,fullscreen:full})
    } catch(error) {
      await page.screenshot({path:path.join(output,v.name+'-failure.png')}).catch(()=>{})
      report.push({viewport:v.name,status:'failed',error:String(error),pageErrors:errors})
    } finally { await context.close() }
  }
} finally {
  await browser?.close()
  server.kill('SIGTERM')
  await mkdir(output,{recursive:true})
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))
}
if(report.some(r=>r.status==='failed')) process.exitCode=1
