export type ShowcaseMode = 'demo' | 'live';

export type ShowcaseMetricSet = {
  inventoryControlCoveragePct: number;
  batchClosurePct: number;
  dataQualityPct: number;
  operationalControlScorePct: number;
};

export type ShowcaseTrendPoint = {
  period: string;
  throughputIndex: number;
  laborEfficiencyIndex: number;
  controlCoveragePct: number;
};

export type ShowcaseData = {
  schemaVersion: 1;
  generatedAt: string;
  mode: ShowcaseMode;
  refreshSeconds: number;
  metrics: ShowcaseMetricSet;
  trend: ShowcaseTrendPoint[];
};
