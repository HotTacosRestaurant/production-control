import type {Site} from '@/lib/pc-types';

export type ManagementSummary = {
  completedCountPairs: number;
  observedCountDays: number;
  countPairCompletionPct: number;
  singleCountDays: number;
  lateEntries: number;
  signerMismatches: number;
  countCorrections: number;
  activeBatches: number;
  completedBatches: number;
  bagsProduced: number;
  outputKg: number;
  trackedLaborHours: number;
  runningTimers: number;
  ingredientEntries: number;
  estimatedConsumptionKg: number;
};

export type SiteKpi = ManagementSummary & {
  siteId: Site;
  siteName: string;
};

export type EmployeeKpi = {
  employeeId: string;
  employeeName: string;
  trackedLaborHours: number;
  batchesTouched: number;
  ingredientEntries: number;
  runningTimers: number;
};

export type ProductKpi = {
  productId: string;
  productName: string;
  completedBatches: number;
  bagsProduced: number;
  outputKg: number;
  trackedLaborHours: number;
  estimatedConsumptionKg: number;
};

export type TrendPoint = {
  month: string;
  completedBatches: number;
  outputKg: number;
  trackedLaborHours: number;
  completedCountPairs: number;
  singleCountDays: number;
};

export type ManagementAlert = {
  kind: 'running-timer' | 'active-batch' | 'missing-count-pair' | 'late-entry';
  severity: 'warning' | 'critical';
  siteId: Site;
  title: string;
  detail: string;
};

export type ManagementData = {
  generatedAt: string;
  summary: ManagementSummary;
  bySite: SiteKpi[];
  byEmployee: EmployeeKpi[];
  byProduct: ProductKpi[];
  trend: TrendPoint[];
  alerts: ManagementAlert[];
};
