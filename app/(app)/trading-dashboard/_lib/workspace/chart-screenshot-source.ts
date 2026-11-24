const sources = new WeakMap<HTMLElement, () => HTMLCanvasElement>()
export function registerChartScreenshot(host: HTMLElement, capture: () => HTMLCanvasElement): () => void {
  sources.set(host, capture)
  return () => { if (sources.get(host) === capture) sources.delete(host) }
}
export function getChartScreenshot(host: HTMLElement): HTMLCanvasElement | null {
  return sources.get(host)?.() ?? null
}
