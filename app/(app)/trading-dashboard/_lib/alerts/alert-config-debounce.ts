export const ALERT_CONFIG_SAVE_DELAY_MS = 2_000

type Timer = ReturnType<typeof setTimeout>

export function createAlertConfigDebouncer(
  onSave: () => void,
  timers: {
    set: (callback: () => void, delay: number) => Timer
    clear: (timer: Timer) => void
  } = { set: setTimeout, clear: clearTimeout },
) {
  let timer: Timer | null = null
  return {
    schedule() {
      if (timer !== null) timers.clear(timer)
      timer = timers.set(() => { timer = null; onSave() }, ALERT_CONFIG_SAVE_DELAY_MS)
    },
    cancel() {
      if (timer !== null) timers.clear(timer)
      timer = null
    },
  }
}
