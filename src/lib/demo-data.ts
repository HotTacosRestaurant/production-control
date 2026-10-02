import type { ControlledProduct, InventoryCount, ProductionBatch, ProductionActivity, ProductionInput } from "./production-model";

/** DATOS FICTICIOS PARA DISEÑO DE INTERFAZ. No proceden de Firestore. */
export const demoProducts: ControlledProduct[] = [
  { id: "demo-birria", name: "Birria", category: "protein", bagWeightKg: 5, active: true, siteIds: ["htl", "htw"] },
  { id: "demo-pastor", name: "Pastor", category: "protein", bagWeightKg: 5, active: true, siteIds: ["htl", "htw", "htft"] },
  { id: "demo-lengua", name: "Lengua", category: "protein", bagWeightKg: 4, active: true, siteIds: ["htl"] },
  { id: "demo-cabeza", name: "Cabeza", category: "protein", bagWeightKg: 2, active: true, siteIds: ["htl", "htw"] },
];
export const demoCounts: InventoryCount[] = [
  { id: "demo-a", siteId: "htl", operationalDate: "2026-10-01", period: "opening", capturedAt: "2026-10-01T12:15:00Z", enteredById: "demo-user", isLateEntry: false, lines: [
    { productId: "demo-birria", bagCount: 5, bagWeightKgSnapshot: 5 },
    { productId: "demo-pastor", bagCount: 6, bagWeightKgSnapshot: 5 },
    { productId: "demo-lengua", bagCount: 3, bagWeightKgSnapshot: 4 },
    { productId: "demo-cabeza", bagCount: 2, bagWeightKgSnapshot: 2 },
  ] },
  { id: "demo-b", siteId: "htl", operationalDate: "2026-09-30", period: "closing", capturedAt: "2026-10-01T15:00:00Z", enteredById: "demo-user", isLateEntry: true, lines: [
    { productId: "demo-birria", bagCount: 5, bagWeightKgSnapshot: 5 },
    { productId: "demo-pastor", bagCount: 6, bagWeightKgSnapshot: 5 },
    { productId: "demo-lengua", bagCount: 3, bagWeightKgSnapshot: 4 },
    { productId: "demo-cabeza", bagCount: 2, bagWeightKgSnapshot: 2 },
  ] },
];
export const demoBatches: ProductionBatch[] = [
  { id: "demo-batch-1", siteId: "htl", productId: "demo-birria", operationalDate: "2026-10-01", status: "active" },
];
export const demoActivities: ProductionActivity[] = [
  { id: "demo-a1", batchId: "demo-batch-1", employeeId: "demo-employee-1", label: "Preparación inicial", state: "paused", intervals: [ { startedAt: "2026-10-01T13:00:00Z", stoppedAt: "2026-10-01T13:15:00Z" } ] },
  { id: "demo-a2", batchId: "demo-batch-1", employeeId: "demo-employee-2", label: "Preparación de ingredientes", state: "paused", intervals: [ { startedAt: "2026-10-01T13:05:00Z", stoppedAt: "2026-10-01T13:25:00Z" } ] },
];
export const demoInputs: ProductionInput[] = [
  { id: "demo-i1", batchId: "demo-batch-1", ingredientName: "Carne", quantity: 20, unit: "kg", recordedById: "demo-employee-1", recordedAt: "2026-10-01T13:10:00Z" },
];
