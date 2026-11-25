import { getChartScreenshot } from './chart-screenshot-source'

type Bounds = { left: number; top: number; width: number; height: number }
export function relativeBounds(rect: Bounds, root: Bounds) {
  return { x: rect.left-root.left, y: rect.top-root.top, width:rect.width, height:rect.height }
}
export function screenshotFilename(symbol: string, paneCount: number, now = new Date()): string {
  return `${symbol}-${paneCount}pane-${now.toISOString().replace(/[:.]/g,'-')}.png`
}

/** Compose official chart snapshots at their current DOM positions, not a reconstructed layout. */
export function captureWorkspace(root: HTMLElement): HTMLCanvasElement {
  const bounds = root.getBoundingClientRect()
  const panes = Array.from(root.querySelectorAll<HTMLElement>(':scope > [data-chart-pane]:not([data-pane-obscured="true"])'))
  if (!bounds.width || !bounds.height || !panes.length) throw new Error('No visible chart workspace')
  const scale = Math.min(window.devicePixelRatio || 1, 2, 8192 / Math.max(bounds.width,bounds.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bounds.width*scale))
  canvas.height = Math.max(1, Math.round(bounds.height*scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.scale(canvas.width/bounds.width,canvas.height/bounds.height)
  const rootStyle = getComputedStyle(root)
  const theme = getComputedStyle(root.closest('.app-shell') ?? root)
  const background = theme.getPropertyValue('--background').trim() || '#fff'
  const foreground = theme.getPropertyValue('--foreground').trim() || '#18212f'
  ctx.fillStyle = rootStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ? background : rootStyle.backgroundColor
  ctx.fillRect(0,0,bounds.width,bounds.height)
  for (const pane of panes) {
    const box = relativeBounds(pane.getBoundingClientRect(),bounds)
    if (!box.width || !box.height) continue
    ctx.save()
    ctx.beginPath();ctx.rect(box.x,box.y,box.width,box.height);ctx.clip()
    ctx.fillStyle=background;ctx.fillRect(box.x,box.y,box.width,box.height)
    const host = pane.querySelector<HTMLElement>('[data-chart-screenshot-host]')
    if (host) {
      const snapshot=getChartScreenshot(host)
      if (!snapshot || !snapshot.width || !snapshot.height) throw new Error('Chart still initializing')
      const dest=relativeBounds(host.getBoundingClientRect(),bounds)
      ctx.drawImage(snapshot,dest.x,dest.y,dest.width,dest.height)
    } else {
      // Preserve the actual visible loading/empty/error state rather than inventing candles.
      const content=pane.querySelector<HTMLElement>('[data-chart-content]')
      ctx.font='12px sans-serif';ctx.fillStyle=foreground;ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText(content?.innerText.trim() || 'Chart unavailable',box.x+box.width/2,box.y+box.height/2,Math.max(1,box.width-8))
    }
    const label = pane.querySelector<HTMLElement>('[aria-label^="Activate "]')
    const labelBox = label ? relativeBounds(label.getBoundingClientRect(),bounds) : {x:box.x+4,y:box.y+4,width:0,height:20}
    const text = (label?.innerText.trim() || pane.dataset.chartPane || '').toUpperCase()
    const bias=pane.dataset.chartBias
    ctx.font='600 11px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle'
    const labelWidth=ctx.measureText(text).width+ (bias === '1'||bias === '-1'||bias === '0'?24:8)
    const labelHeight=Math.max(18,labelBox.height)
    ctx.fillStyle=background;ctx.fillRect(labelBox.x,labelBox.y,labelWidth,labelHeight)
    ctx.fillStyle=foreground;ctx.fillText(text,labelBox.x+4,labelBox.y+labelHeight/2)
    if(bias==='1'||bias==='-1'||bias==='0'){
      ctx.fillStyle=bias==='1'?'#059669':bias==='-1'?'#dc2626':foreground
      ctx.fillText(bias==='1'?'↑':bias==='-1'?'↓':'−',labelBox.x+labelWidth-14,labelBox.y+labelHeight/2)
    }
    ctx.restore()
  }
  return canvas
}

type SaveHandle = { createWritable(): Promise<{write(blob: Blob):Promise<void>;close():Promise<void>;abort():Promise<void>}> }
type PickerWindow = Window & { showSaveFilePicker?: (options: {suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<SaveHandle> }
function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG encoding failed')),'image/png'))
}
export async function saveWorkspaceScreenshot(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const picker=(window as PickerWindow).showSaveFilePicker
  if (picker && window.isSecureContext) {
    // Must invoke synchronously from the click, before asynchronous encoding.
    let handle: SaveHandle
    try { handle=await picker.call(window,{suggestedName:filename,types:[{description:'PNG image',accept:{'image/png':['.png']}}]}) }
    catch (error) {
      if (!(error instanceof DOMException) || !['SecurityError','NotSupportedError'].includes(error.name)) throw error
      return downloadPng(canvas,filename)
    }
    const blob=await pngBlob(canvas)
    const writer=await handle.createWritable()
    try { await writer.write(blob);await writer.close() }
    catch (error) { await writer.abort().catch(()=>{});throw error }
    return
  }
  await downloadPng(canvas,filename)
}
async function downloadPng(canvas:HTMLCanvasElement,filename:string) {
  const url=URL.createObjectURL(await pngBlob(canvas))
  const link=document.createElement('a')
  link.href=url;link.download=filename
  document.body.append(link)
  try { link.click() } finally {link.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000)}
}
