import type { ShelfLifeInferenceSummary } from './shelf-life-inference';

export interface StockEvaluationSummary {
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface DailyStockWorkflowSummary {
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  shelfLife: ShelfLifeInferenceSummary;
  evaluation: StockEvaluationSummary;
}
