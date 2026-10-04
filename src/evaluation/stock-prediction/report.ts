import { JEV_STOCK_PREDICTION_MIN_CONFIDENCE } from '../../estimation/jev-stock-prediction-advisor.service';
import { groundTruth, hash, parseDataset } from './dataset';
import { scoreCases, sliceMetrics } from './metrics';
import { assessLaunch } from './launch-policy';
import { selectedInputHash } from './reconstruction';
import {
  executionSchema,
  reportSchema,
  type StockReport,
} from './report-contract';

export function createEvaluationReport(
  datasetValue: unknown,
  executionValue: unknown,
): StockReport {
  const dataset = parseDataset(datasetValue);
  const execution = executionSchema.parse(executionValue);
  const selected = dataset.cases.filter((c) => c.split === execution.split);
  if (
    execution.datasetHash !== hash(dataset) ||
    execution.datasetVersion !== dataset.version ||
    execution.inputHash !== selectedInputHash(selected) ||
    execution.selectedCaseCount !== selected.length ||
    execution.observations.some((row, i) => row.caseId !== selected[i]?.id)
  )
    throw new Error('Stock execution does not match selected dataset');
  const caseAssessments = selected.map((c) => ({
    caseId: c.id,
    episodeId: c.episodeId,
    productGroupId: c.productGroupId,
    source: c.source,
    review: c.review,
    truth: groundTruth(c),
  }));
  const datasetSummary = {
    historicalCount: selected.filter((c) => c.source === 'historical').length,
    reviewedCount: selected.filter((c) => c.review.status === 'reviewed')
      .length,
    frozenCount: selected.filter(
      (c) =>
        c.review.status === 'reviewed' &&
        Date.parse(c.review.reviewedAt!) <= Date.parse(execution.startedAt),
    ).length,
    productGroupCount: new Set(selected.map((c) => c.productGroupId)).size,
  };
  const body = {
    ...execution,
    confidenceGate: JEV_STOCK_PREDICTION_MIN_CONFIDENCE,
    caseAssessments,
    datasetSummary,
    resolvedModels: [
      ...new Set(
        execution.observations.flatMap((row) =>
          row.resolvedModel ? [row.resolvedModel] : [],
        ),
      ),
    ].sort(),
    metrics: scoreCases(selected, execution.observations),
    slices: sliceMetrics(selected, execution.observations),
  };
  return reportSchema.parse({ ...body, ...assessLaunch(body) });
}
export function parseEvaluationReport(
  value: unknown,
  dataset: unknown,
): StockReport {
  const parsed = reportSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid stock evaluation report');
  const execution = Object.fromEntries(
    Object.keys(executionSchema.shape).map((key) => [
      key,
      parsed.data[key as keyof typeof parsed.data],
    ]),
  );
  const expected = createEvaluationReport(dataset, execution);
  if (hash(expected) !== hash(parsed.data))
    throw new Error(
      'Stock report does not match dataset or calculated metrics',
    );
  return parsed.data;
}
export function summarizeReport(report: StockReport): string {
  const precision = report.metrics.acceptedLowOutPrecision;
  return [
    `${report.evidenceMode} ${report.split}: ${report.observations.length}/${report.selectedCaseCount} cases`,
    `Accepted low/out precision: ${precision.value === null ? 'n/a' : (precision.value * 100).toFixed(2) + '%'} (${precision.numerator}/${precision.denominator})`,
    `Accepted coverage: ${report.metrics.acceptedCoverage.numerator}/${report.metrics.acceptedCoverage.denominator}`,
    `Launch evidence: ${report.launchEvidence}; ${report.launchReasons.join(', ') || 'operator review required'}`,
  ].join('\n');
}
