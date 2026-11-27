/** Specification-stage contracts; no runtime implementation yet. */
export type Timeframe = "M3" | "M15";
export type MarketRegime = "uptrend" | "downtrend" | "ranging" | "transition" | "unknown";
export type AnalysisStatus = "ok" | "insufficient_data" | "not_applicable" | "error";
export interface Candle {
  readonly closeTime: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number | null;
}
export interface MarketSnapshot {
  readonly id: string;
  readonly symbol: "EURUSD";
  readonly asOf: string;
  readonly source: string;
  readonly volumeKind: "tick" | "actual" | "unknown";
  readonly pointSize: number;
  readonly bars: Readonly<Record<Timeframe, readonly Candle[]>>;
}
export interface NumericalFeature {
  readonly value: number | null;
  readonly unit: string;
  readonly lookbackBars: number;
  readonly percentile?: number;
  readonly change?: number;
  readonly evidenceIds: readonly string[];
}
export interface EvidenceReference {
  readonly id: string;
  readonly snapshotId: string;
  readonly timeframe: Timeframe;
  readonly from: string;
  readonly through: string;
  readonly calculationId: string;
  readonly calculationVersion: string;
  readonly configVersion: string;
}
export interface AnalysisResult {
  readonly toolId: string;
  readonly version: string;
  readonly timeframe: Timeframe | "multi";
  readonly asOf: string;
  readonly status: AnalysisStatus;
  readonly features: Readonly<Record<string, NumericalFeature>>;
  readonly evidence: readonly EvidenceReference[];
  readonly limitations: readonly string[];
}
export interface AnalysisContext {
  readonly snapshot: MarketSnapshot;
  readonly configVersion: string;
}
export interface AnalysisTool {
  readonly id: string;
  readonly version: string;
  readonly applicableRegimes: readonly MarketRegime[];
  readonly requiredIndicators: readonly string[];
  readonly minHistoryBars: number;
  execute(context: AnalysisContext, timeframe: Timeframe | "multi"): AnalysisResult;
}
export interface RiskFinding {
  readonly id: string;
  readonly category: "market" | "structure" | "position" | "behavior" | "data";
  readonly severity: "low" | "medium" | "high";
  readonly warning: string;
  readonly evidenceIds: readonly string[];
  readonly knowledgeIds: readonly string[];
  readonly limitations: readonly string[];
}
export interface MarketAnalysisReport {
  readonly schemaVersion: "1";
  readonly runId: string;
  readonly snapshotId: string;
  readonly asOf: string;
  readonly configVersion: string;
  readonly knowledgeVersion: string;
  readonly status: "complete" | "partial" | "failed";
  readonly regimes: Readonly<Record<Timeframe, MarketRegime>>;
  readonly results: readonly AnalysisResult[];
  readonly findings: readonly RiskFinding[];
  readonly limitations: readonly string[];
}
