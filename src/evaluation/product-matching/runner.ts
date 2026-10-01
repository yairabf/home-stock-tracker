import { JevDecisionClient } from '../../llm/typesafe/jev-decision.client';
import type {
  JevChoiceRequest,
  JevDecisionResult,
} from '../../llm/typesafe/jev-decision.types';
import {
  JevProductResolutionAdvisor,
  JEV_PRODUCT_RESOLUTION_VERSION,
} from '../../product/jev-product-resolution-advisor.service';
import type { ProductResolutionProposal } from '../../product/types/product-resolution';
import {
  type EvaluationCase,
  type EvaluationDataset,
  type EvaluationSplit,
} from './dataset';
import {
  jevModelSchema,
  observationSchema,
  parseRecordedRun,
  type EvaluationObservation,
  type RecordedRun,
} from './observations';
import { createEvaluationReport, type ReportMetadata } from './scoring';

export function liveConfiguration(environment: NodeJS.ProcessEnv) {
  const typesafeApiKey = environment.TYPESAFE_API_KEY?.trim();
  const model = jevModelSchema.safeParse(environment.JEV_MODEL?.trim());
  if (!typesafeApiKey || !model.success)
    throw new Error(
      'Live evaluation requires private TYPESAFE_API_KEY and a pinned JEV_MODEL',
    );
  return { typesafeApiKey, jevModel: model.data };
}

class RecordingClient extends JevDecisionClient {
  result: JevDecisionResult | null = null;
  constructor(
    private readonly replay: RecordedRun['rows'][number] | undefined,
    config: { typesafeApiKey?: string; jevModel?: string },
    fetcher?: typeof fetch,
  ) {
    super(config, fetcher);
  }

  override async choose(request: JevChoiceRequest): Promise<JevDecisionResult> {
    this.result = this.replay
      ? this.replay.transport
      : await super.choose(request);
    if (!this.result) throw new Error('Unexpected call for skipped replay');
    return this.result;
  }
}

function projectProposal(proposal: ProductResolutionProposal) {
  if (proposal.recommendation === 'add_alias')
    return {
      recommendation: proposal.recommendation,
      targetProductId: proposal.targetProductId,
      confidence: proposal.confidence,
    };
  if (proposal.recommendation === 'ask_user_to_choose')
    return {
      recommendation: proposal.recommendation,
      candidateProductIds: proposal.candidateProductIds,
      confidence: proposal.confidence,
    };
  throw new Error('Jev emitted an unsupported proposal');
}

async function observeCase(
  item: EvaluationCase,
  model: string,
  client: RecordingClient,
  recordedElapsed?: number,
): Promise<EvaluationObservation> {
  const started = performance.now();
  const advice = await new JevProductResolutionAdvisor(client).advise(
    item.context,
  );
  const result = client.result;
  const base = {
    caseId: item.id,
    configuredModel: model,
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    elapsedMs: recordedElapsed ?? performance.now() - started,
  };
  if (result?.status === 'success')
    return observationSchema.parse({
      ...base,
      callStatus: 'success',
      resolvedModel: result.model,
      decision: { choice: result.choice, confidence: result.confidence },
      usage: result.usage,
      unavailableReason: null,
      proposal:
        advice.status === 'success' ? projectProposal(advice.value) : null,
    });
  return observationSchema.parse({
    ...base,
    callStatus: result ? 'unavailable' : 'skipped',
    resolvedModel: null,
    decision: null,
    usage: null,
    proposal: null,
    unavailableReason: result?.status === 'unavailable' ? result.reason : null,
  });
}

export type ExecutionOptions =
  | {
      mode: 'offline';
      recorded: unknown;
    }
  | {
      mode: 'live';
      environment: NodeJS.ProcessEnv;
      fetcher?: typeof fetch;
    };

export async function executeEvaluation(
  dataset: EvaluationDataset,
  split: EvaluationSplit,
  options: ExecutionOptions,
  context: {
    signal?: AbortSignal;
    purpose?: 'smoke' | 'evaluation';
    codeRevision?: string | null;
    codeDirty?: boolean;
  } = {},
) {
  const cases = dataset.cases.filter((item) => item.split === split);
  if (cases.length === 0 || cases.length > 200)
    throw new Error('Select between 1 and 200 cases');
  const replay =
    options.mode === 'offline'
      ? parseRecordedRun(options.recorded, dataset, split)
      : undefined;
  const config =
    options.mode === 'live'
      ? liveConfiguration(options.environment)
      : { jevModel: replay!.configuredModel };
  const byId = new Map(replay?.rows.map((row) => [row.caseId, row]));
  const rows: EvaluationObservation[] = [];
  const startedAt = new Date().toISOString();
  for (const item of cases) {
    if (context.signal?.aborted) break;
    const recorded = byId.get(item.id);
    const client = new RecordingClient(
      recorded,
      config,
      options.mode === 'live' ? options.fetcher : undefined,
    );
    rows.push(
      await observeCase(item, config.jevModel, client, recorded?.elapsedMs),
    );
  }
  const metadata: ReportMetadata = {
    evidenceMode: options.mode,
    purpose: context.purpose ?? 'evaluation',
    configuredModel: config.jevModel,
    startedAt,
    finishedAt: new Date().toISOString(),
    codeRevision: context.codeRevision ?? null,
    codeDirty: context.codeDirty ?? true,
    complete: rows.length === cases.length && !context.signal?.aborted,
  };
  return createEvaluationReport(dataset, split, rows, metadata);
}
