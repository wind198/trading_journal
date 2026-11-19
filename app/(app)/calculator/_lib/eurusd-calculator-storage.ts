export type EurusdCalculatorInputs = {
  riskUsd?: string
  stopLossPoints?: string
}

type CalculatorStorage = Pick<Storage, 'getItem' | 'setItem'>

const STORAGE_KEY = 'lot-size-calculator.eurusd-inputs'

function validPositiveInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? value.trim() : null
}

export function readEurusdCalculatorInputs(
  storage: Pick<CalculatorStorage, 'getItem'>,
): EurusdCalculatorInputs {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const values = parsed as Record<string, unknown>
    const riskUsd = validPositiveInput(values.riskUsd)
    const stopLossPoints = validPositiveInput(values.stopLossPoints)
    return {
      ...(riskUsd ? { riskUsd } : {}),
      ...(stopLossPoints ? { stopLossPoints } : {}),
    }
  } catch {
    return {}
  }
}

export function writeEurusdCalculatorInputs(
  storage: CalculatorStorage,
  inputs: { riskUsd: string; stopLossPoints: string },
): void {
  try {
    const current = readEurusdCalculatorInputs(storage)
    const riskUsd = validPositiveInput(inputs.riskUsd) ?? current.riskUsd
    const stopLossPoints = validPositiveInput(inputs.stopLossPoints) ?? current.stopLossPoints
    if (!riskUsd && !stopLossPoints) return
    storage.setItem(STORAGE_KEY, JSON.stringify({
      ...(riskUsd ? { riskUsd } : {}),
      ...(stopLossPoints ? { stopLossPoints } : {}),
    }))
  } catch {
    // Quota / private mode — keep the calculator usable without persistence.
  }
}
