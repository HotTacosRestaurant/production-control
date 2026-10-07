import 'server-only';

import { buildManagementData } from '@/lib/pc-kpis-server';
import type { ShowcaseData, ShowcaseMetricSet, ShowcaseTrendPoint } from '@/lib/showcase-model';

const MIN_REFRESH_SECONDS = 60;
const MAX_REFRESH_SECONDS = 3600;
const DEFAULT_REFRESH_SECONDS = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(numerator: number, denominator: number, fallback = 100): number {
  if (!denominator) return fallback;
  return round1(clamp((numerator / denominator) * 100, 0, 100));
}

function refreshSeconds(): number {
  const configured = Number(process.env.SHOWCASE_REFRESH_SECONDS ?? DEFAULT_REFRESH_SECONDS);
  if (!Number.isFinite(configured)) return DEFAULT_REFRESH_SECONDS;
  return Math.round(clamp(configured, MIN_REFRESH_SECONDS, MAX_REFRESH_SECONDS));
}

function livePublishingApproved(): boolean {
  return (
    process.env.SHOWCASE_MODE?.trim().toLowerCase() === 'live' &&
    process.env.SHOWCASE_OWNER_APPROVED_REAL_DATA?.trim().toLowerCase() === 'true'
  );
}

function demoData(): ShowcaseData {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'demo',
    refreshSeconds: refreshSeconds(),
    metrics: {
      inventoryControlCoveragePct: 96.8,
      batchClosurePct: 93.4,
      dataQualityPct: 97.6,
      operationalControlScorePct: 95.7,
    },
    trend: [
      { period: 'P-5', throughputIndex: 100, laborEfficiencyIndex: 100, controlCoveragePct: 88.9 },
      { period: 'P-4', throughputIndex: 104, laborEfficiencyIndex: 103, controlCoveragePct: 91.7 },
      { period: 'P-3', throughputIndex: 109, laborEfficiencyIndex: 105, controlCoveragePct: 94.1 },
      { period: 'P-2', throughputIndex: 112, laborEfficiencyIndex: 108, controlCoveragePct: 95.5 },
      { period: 'P-1', throughputIndex: 116, laborEfficiencyIndex: 111, controlCoveragePct: 96.2 },
      { period: 'P0', throughputIndex: 121, laborEfficiencyIndex: 114, controlCoveragePct: 96.8 },
    ],
  };
}

function baseline(values: number[]): number {
  const first = values.find((value) => Number.isFinite(value) && value > 0);
  return first && first > 0 ? first : 1;
}

async function liveData(): Promise<ShowcaseData> {
  const management = await buildManagementData();
  const summary = management.summary;

  const totalCountDocuments = summary.completedCountPairs * 2 + summary.singleCountDays;
  const dataIssues = summary.lateEntries + summary.signerMismatches + summary.countCorrections;
  const dataQualityPct = totalCountDocuments
    ? round1(clamp(100 - (dataIssues / totalCountDocuments) * 100, 0, 100))
    : 100;

  const totalBatches = summary.completedBatches + summary.activeBatches;
  const batchClosurePct = pct(summary.completedBatches, totalBatches);
  const inventoryControlCoveragePct = round1(clamp(summary.countPairCompletionPct, 0, 100));
  const operationalControlScorePct = round1(
    inventoryControlCoveragePct * 0.4 + batchClosurePct * 0.35 + dataQualityPct * 0.25,
  );

  const metrics: ShowcaseMetricSet = {
    inventoryControlCoveragePct,
    batchClosurePct,
    dataQualityPct,
    operationalControlScorePct,
  };

  const sourceTrend = management.trend.slice(-6);
  const throughputBase = baseline(sourceTrend.map((row) => row.outputKg));
  const efficiencyValues = sourceTrend.map((row) =>
    row.trackedLaborHours > 0 ? row.outputKg / row.trackedLaborHours : 0,
  );
  const efficiencyBase = baseline(efficiencyValues);

  const trend: ShowcaseTrendPoint[] = sourceTrend.map((row, index) => {
    const groups = row.completedCountPairs + row.singleCountDays;
    const laborEfficiency = row.trackedLaborHours > 0 ? row.outputKg / row.trackedLaborHours : 0;
    const periodsBack = sourceTrend.length - 1 - index;

    return {
      period: periodsBack === 0 ? 'P0' : `P-${periodsBack}`,
      throughputIndex: round1((row.outputKg / throughputBase) * 100),
      laborEfficiencyIndex: round1((laborEfficiency / efficiencyBase) * 100),
      controlCoveragePct: pct(row.completedCountPairs, groups),
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'live',
    refreshSeconds: refreshSeconds(),
    metrics,
    trend,
  };
}

/**
 * Public-showcase boundary.
 *
 * This function deliberately returns only approved aggregate/normalized fields.
 * It never returns site names, product names, employee names, document IDs,
 * raw counts, absolute production quantities, labor-hour totals, or source docs.
 */
export async function buildShowcaseData(): Promise<ShowcaseData> {
  if (!livePublishingApproved()) return demoData();
  return liveData();
}
