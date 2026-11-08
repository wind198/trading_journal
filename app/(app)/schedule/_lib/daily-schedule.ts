export type ScheduleMode = 'PREP' | 'TRADE' | 'NO_TRADE' | 'MANAGE' | 'JOURNAL'

export type ScheduleBlock = {
  startMin: number
  endMin: number
  life: string
  market: string
  mode: ScheduleMode
  modeLabel: string
  actions: string
}

const hm = (h: number, m = 0) => h * 60 + m

/** Visible day span for proportional layout (matches timetable). */
export const SCHEDULE_DAY_START_MIN = hm(5, 30)
export const SCHEDULE_DAY_END_MIN = hm(22, 0)
export const SCHEDULE_DAY_SPAN_MIN = SCHEDULE_DAY_END_MIN - SCHEDULE_DAY_START_MIN

/** From daily_prep.md timetable (UTC+7). */
export const DAILY_SCHEDULE: readonly ScheduleBlock[] = [
  {
    startMin: hm(5, 30),
    endMin: hm(6, 0),
    life: 'Wake / settle',
    market: 'Asia',
    mode: 'PREP',
    modeLabel: 'PREP',
    actions:
      'Open EURUSD only. HTF bias. Mark key levels. Skim overnight structure. FTMO risk check (daily loss room).',
  },
  {
    startMin: hm(6, 0),
    endMin: hm(6, 15),
    life: 'Home desk',
    market: 'Asia',
    mode: 'PREP',
    modeLabel: 'PREP',
    actions:
      'Run decision-flow gates. Classify regime. Write Plan A / Plan B for 06:20–07:40. If gates fail → stay PREP / WAIT.',
  },
  {
    startMin: hm(6, 15),
    endMin: hm(7, 40),
    life: 'Home desk',
    market: 'Asia',
    mode: 'TRADE',
    modeLabel: 'TRADE',
    actions:
      'Focused scalp window. Only A/B setups. One idea at a time. Slow entries. No chase. Allow time for post-open correction.',
  },
  {
    startMin: hm(7, 40),
    endMin: hm(7, 45),
    life: 'Leave soon',
    market: 'Asia',
    mode: 'MANAGE',
    modeLabel: 'MANAGE',
    actions: 'No new entries. Flatten or set hard manage. Close charts. Hard TRADE cutoff 07:45.',
  },
  {
    startMin: hm(7, 45),
    endMin: hm(9, 0),
    life: 'Commute → breakfast → bike park → walk to office',
    market: 'Asia',
    mode: 'NO_TRADE',
    modeLabel: 'NO TRADE',
    actions: 'No entries / no phone scalps. Traffic waits: notes only. Breakfast/walk: observe only.',
  },
  {
    startMin: hm(9, 0),
    endMin: hm(9, 30),
    life: 'Early office',
    market: 'Asia → late Asia',
    mode: 'NO_TRADE',
    modeLabel: 'NO TRADE',
    actions: 'Settle into work. Capture commute notes. No entries before non-trade band.',
  },
  {
    startMin: hm(9, 30),
    endMin: hm(11, 45),
    life: 'Work',
    market: '—',
    mode: 'NO_TRADE',
    modeLabel: 'NO TRADE',
    actions: 'App non-trade. Notes only if a glance happens.',
  },
  {
    startMin: hm(11, 45),
    endMin: hm(12, 0),
    life: 'Pre-noon',
    market: 'Asia / pre-London',
    mode: 'PREP',
    modeLabel: 'PREP',
    actions: 'Re-mark levels. London approach. Plan A/B for noon. Confirm risk room.',
  },
  {
    startMin: hm(12, 0),
    endMin: hm(13, 20),
    life: 'Noon break',
    market: 'Pre-London',
    mode: 'TRADE',
    modeLabel: 'TRADE',
    actions: 'Focused scalp if setup ready. TP ≥ 50pt. Same decision-flow gates.',
  },
  {
    startMin: hm(13, 20),
    endMin: hm(13, 30),
    life: 'End break',
    market: 'Pre-London',
    mode: 'MANAGE',
    modeLabel: 'MANAGE',
    actions: 'No new entries. Flatten or hard manage. Return to work clean.',
  },
  {
    startMin: hm(13, 30),
    endMin: hm(14, 30),
    life: 'Work',
    market: 'London open approach',
    mode: 'NO_TRADE',
    modeLabel: 'NO TRADE / rare TRADE',
    actions:
      'Default skip. Only if still free and A+ already marked at 11:45–12:00. Stop new entries by 14:25.',
  },
  {
    startMin: hm(14, 30),
    endMin: hm(18, 30),
    life: 'Work / commute home',
    market: 'London',
    mode: 'NO_TRADE',
    modeLabel: 'NO TRADE',
    actions: 'App non-trade. Light watch / notes only — no entries.',
  },
  {
    startMin: hm(18, 30),
    endMin: hm(19, 35),
    life: 'Home settle',
    market: 'London',
    mode: 'PREP',
    modeLabel: 'PREP',
    actions: 'Food / reset. Re-mark levels. London–NY overlap plan. Risk check. Do not force early entries.',
  },
  {
    startMin: hm(19, 35),
    endMin: hm(21, 30),
    life: 'Home desk',
    market: 'London / NY overlap',
    mode: 'TRADE',
    modeLabel: 'TRADE',
    actions: 'Main evening focused window. Slow, one idea at a time. TP ≥ 50pt.',
  },
  {
    startMin: hm(21, 30),
    endMin: hm(22, 0),
    life: 'Wind down',
    market: '—',
    mode: 'JOURNAL',
    modeLabel: 'JOURNAL',
    actions: 'Log trades / mistakes. Watch levels for tomorrow morning. Stop.',
  },
]

export function formatScheduleClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatScheduleRange(startMin: number, endMin: number): string {
  return `${formatScheduleClock(startMin)}–${formatScheduleClock(endMin)}`
}
