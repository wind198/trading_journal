export type EurusdLotSizeResult = {
  rawLots: number
  lotSize: number
  actualRiskUsd: number
}

const USD_PER_POINT_PER_LOT = 1
const LOT_STEP = 0.01

export function calculateEurusdLotSize(
  riskUsd: number,
  stopLossPoints: number,
): EurusdLotSizeResult | null {
  if (
    !Number.isFinite(riskUsd) ||
    !Number.isFinite(stopLossPoints) ||
    riskUsd <= 0 ||
    stopLossPoints <= 0
  ) {
    return null
  }

  const rawLots = riskUsd / (stopLossPoints * USD_PER_POINT_PER_LOT)
  const lotSize = Math.floor((rawLots + 1e-10) / LOT_STEP) * LOT_STEP
  const actualRiskUsd = Math.round(lotSize * stopLossPoints * USD_PER_POINT_PER_LOT * 100) / 100

  return { rawLots, lotSize, actualRiskUsd }
}
