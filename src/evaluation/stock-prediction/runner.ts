import { JevDecisionClient } from '../../llm/typesafe/jev-decision.client';
import type {
  JevChoiceRequest,
  JevDecisionResult,
} from '../../llm/typesafe/jev-decision.types';
import {
  JevStockPredictionAdvisor,
  JEV_STOCK_PREDICTION_MIN_CONFIDENCE,
  JEV_STOCK_PREDICTION_VERSION,
} from '../../estimation/jev-stock-prediction-advisor.service';
import {
  applyHybridReasoning,
  buildDisabledResult,
} from '../../estimation/hybrid-calculation';
import type { EstimationResult } from '../../estimation/types/estimation-result';
import {
  hash,
  parseDataset,
  REPLAY_VERSION,
  splitSchema,
  type StockCase,
  type StockSplit,
} from './dataset';
import {
  transportSchema,
  modelSchema,
  observationSchema,
  parseRecordedRun,
  type RecordedRun,
  type StockObservation,
} from './observations';
import { reconstructCase, selectedInputHash } from './reconstruction';

export function liveConfiguration(environment: NodeJS.ProcessEnv) {
  const typesafeApiKey = environment.TYPESAFE_API_KEY?.trim();
  const model = modelSchema.safeParse(environment.JEV_MODEL?.trim());
  if (!typesafeApiKey || !model.success)
    throw new Error(
      'Live stock evaluation requires private TYPESAFE_API_KEY and pinned JEV_MODEL',
    );
  return { typesafeApiKey, jevModel: model.data };
}
class RecordingClient extends JevDecisionClient {
  result: JevDecisionResult | null = null;
  elapsedMs = 0;
  constructor(
    private readonly replay: RecordedRun['rows'][number] | undefined,
    config: { typesafeApiKey?: string; jevModel: string },
    fetcher?: typeof fetch,
  ) {
    super(config, fetcher);
  }
  override async choose(request: JevChoiceRequest): Promise<JevDecisionResult> {
    const started = performance.now();
    try {
      this.result = this.replay
        ? this.replay.transport
        : await super.choose(request);
      if (!this.result) throw new Error('Unexpected call for skipped replay');
      return this.result;
    } finally {
      this.elapsedMs = performance.now() - started;
    }
  }
}
function projectResult(result: EstimationResult) {
  return {
    predictedState: result.predictedState,
    confidenceScore: result.confidenceScore,
    llmContributed: result.llmContributed,
  };
}
async function observe(
  item: StockCase,
  client: RecordingClient,
  elapsedMs?: number,
) {
  const { candidate, bypassReason } = reconstructCase(item);
  const baseline = item.product.predictionEnabled
    ? (
        await applyHybridReasoning(item.id, candidate, {
          provider: 'typesafe',
          reason: async () => ({ status: 'unavailable' }),
        })
      ).result
    : buildDisabledResult(item.id, item.product.productType);
  const final = item.product.predictionEnabled
    ? (
        await applyHybridReasoning(
          item.id,
          candidate,
          new JevStockPredictionAdvisor(client),
        )
      ).result
    : baseline;
  const transport =
    client.result === null ? null : transportSchema.parse(client.result);
  const success = transport?.status === 'success' ? transport : null;
  const accepted = final.llmAttempt?.accepted ?? false;
  const rejectionReason =
    success && !accepted
      ? success.confidence < JEV_STOCK_PREDICTION_MIN_CONFIDENCE
        ? 'low_confidence'
        : success.choice === 'uncertain'
          ? 'uncertain'
          : 'insufficient_cold_start'
      : null;
  const row = observationSchema.parse({
    caseId: item.id,
    inputHash: selectedInputHash([item]),
    bypassReason,
    callStatus: bypassReason ? 'skipped' : success ? 'success' : 'unavailable',
    failureReason:
      bypassReason || success
        ? null
        : transport?.status === 'unavailable'
          ? transport.reason
          : 'invalid_request',
    resolvedModel: success?.model ?? null,
    usage: success?.usage ?? null,
    elapsedMs: elapsedMs ?? client.elapsedMs,
    rawDecision: success
      ? { choice: success.choice, confidence: success.confidence }
      : null,
    accepted,
    rejectionReason,
    baseline: projectResult(baseline),
    final: projectResult(final),
    coldStart: candidate.signals.coldStart,
    hasLearnedStatistics: candidate.signals.hasLearnedStatistics,
  });
  return {
    row,
    recorded: { caseId: item.id, elapsedMs: row.elapsedMs, transport },
  };
}
export type ExecutionOptions =
  | { mode: 'offline'; recorded: unknown }
  | { mode: 'live'; environment: NodeJS.ProcessEnv; fetcher?: typeof fetch };
export interface ExecutionContext {
  signal?: AbortSignal;
  purpose?: 'smoke' | 'evaluation';
  codeRevision?: string | null;
  codeDirty?: boolean;
}
export async function executeEvaluation(
  value: unknown,
  selectedSplit: StockSplit,
  options: ExecutionOptions,
  context: ExecutionContext = {},
) {
  const dataset = parseDataset(value);
  const split = splitSchema.parse(selectedSplit);
  const cases = dataset.cases.filter((c) => c.split === split);
  if (!cases.length) throw new Error('Select between 1 and 200 stock cases');
  const datasetHash = hash(dataset);
  const inputHash = selectedInputHash(cases);
  const replay =
    options.mode === 'offline'
      ? parseRecordedRun(options.recorded, dataset, split)
      : undefined;
  const config =
    options.mode === 'live'
      ? liveConfiguration(options.environment)
      : { jevModel: replay!.configuredModel };
  const byId = new Map(replay?.rows.map((row) => [row.caseId, row]));
  const observations: StockObservation[] = [];
  const recordedRows: RecordedRun['rows'] = [];
  const startedAt = new Date().toISOString();
  for (const item of cases) {
    if (context.signal?.aborted) break;
    const recorded = byId.get(item.id);
    const client = new RecordingClient(
      recorded,
      config,
      options.mode === 'live' ? options.fetcher : undefined,
    );
    const result = await observe(item, client, recorded?.elapsedMs);
    observations.push(result.row);
    recordedRows.push(result.recorded);
  }
  return {
    schemaVersion: 1 as const,
    evidenceMode: options.mode,
    purpose: context.purpose ?? 'evaluation',
    datasetVersion: dataset.version,
    datasetHash,
    inputHash,
    split,
    configuredModel: config.jevModel,
    taskVersion: JEV_STOCK_PREDICTION_VERSION,
    replayVersion: REPLAY_VERSION,
    codeRevision: context.codeRevision ?? null,
    codeDirty: context.codeDirty ?? true,
    startedAt,
    finishedAt: new Date().toISOString(),
    selectedCaseCount: cases.length,
    complete: observations.length === cases.length && !context.signal?.aborted,
    observations,
    recording: {
      schemaVersion: 1 as const,
      evidenceMode: 'offline' as const,
      datasetHash,
      inputHash,
      split,
      configuredModel: config.jevModel,
      taskVersion: JEV_STOCK_PREDICTION_VERSION,
      replayVersion: REPLAY_VERSION,
      rows: recordedRows,
    },
  };
}
export type StockExecution = Awaited<ReturnType<typeof executeEvaluation>>;
