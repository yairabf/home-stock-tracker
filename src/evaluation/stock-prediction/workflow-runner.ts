import { Test } from '@nestjs/testing';
import { ServiceAuthConfigService } from '../../auth/service-auth-config.service';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  STOCK_WORKFLOW_CONFIG,
  type ModelConfig,
} from '../../config/application-config';
import { JevDecisionClient } from '../../llm/typesafe/jev-decision.client';
import { LLM_PROVIDER } from '../../llm/llm-provider';
import { SHELF_LIFE_POLICY } from '../../inventory/shelf-life-policy';
import { DailyStockWorkflowService } from '../../inventory/daily-stock-workflow.service';
import { LowStockRecommendationService } from '../../inventory/low-stock-recommendation.service';
import { OperationalLogger } from '../../observability/operational-logger.service';
import { ChoiceRecorder } from '../application-inference/choice-recorder';
import { RequestBudget } from '../application-inference/request-budget';
import {
  assertWorkflowDatabase,
  assertEmptyDatabase,
  seedWorkflowCase,
} from './workflow-seed';
import {
  parseWorkflowDataset,
  selectWorkflowCases,
  type WorkflowDataset,
} from './workflow-dataset';
import {
  parseWorkflowRecording,
  type WorkflowRecording,
} from './workflow-recording';
import {
  workflowObservationSchema,
  type WorkflowObservation,
} from './workflow-metrics';
import type {
  JevChoiceRequest,
  JevDecisionResult,
} from '../../llm/typesafe/jev-decision.types';

interface WorkflowExecution {
  databaseUrl: string;
  signal?: AbortSignal;
  split: 'held_out' | 'tuning';
  model: string;
  recording?: WorkflowRecording;
  typesafeApiKey?: string;
  budget?: RequestBudget;
  fetcher?: typeof fetch;
  beforeReply?: (prisma: PrismaClient, productId: string) => Promise<void>;
}
class WorkflowChoiceProxy extends JevDecisionClient {
  active: ChoiceRecorder | null = null;
  hook: (() => Promise<void>) | undefined;
  override async choose(
    request: JevChoiceRequest,
    budget?: number,
  ): Promise<JevDecisionResult> {
    if (!this.active) throw new Error('Unexpected workflow inference');
    const response = await this.active.choose(request, budget);
    await this.hook?.();
    return response;
  }
}
async function readProjection(
  prisma: PrismaClient,
  recommendations: LowStockRecommendationService,
  id: string,
) {
  const p = await prisma.stockProjection.findUniqueOrThrow({
    where: { productId: id },
  });
  const selected = await recommendations.getRecommendations();
  return {
    state: p.estimatedState,
    confidence: p.confidence,
    quantity: p.estimatedQuantity,
    recordedQuantity: p.recordedQuantity,
    recommended: selected.some((r) => r.productId === id),
    reason: p.reason,
  };
}
async function runCase(
  prisma: PrismaClient,
  c: WorkflowDataset['history']['cases'][number],
  dataset: WorkflowDataset,
  options: WorkflowExecution,
  proxy: WorkflowChoiceProxy,
  workflow: DailyStockWorkflowService,
  recommendations: LowStockRecommendationService,
  settings: { adviceEnabled: boolean },
) {
  const snapshot = dataset.snapshots.find((s) => s.caseId === c.id)!;
  const productId = await seedWorkflowCase(prisma, c, snapshot);
  const recorded = options.recording?.rows.find((r) => r.caseId === c.id);
  const client = new ChoiceRecorder(
    options.model,
    options.recording ? recorded!.calls : undefined,
    { typesafeApiKey: options.typesafeApiKey },
    options.budget?.fetch('typesafe', options.fetcher),
  );
  proxy.active = client;
  settings.adviceEnabled = false;
  const baselineRun = await workflow.run(new Date(c.asOf), [productId]);
  if (baselineRun.evaluation.failed)
    throw new Error('Baseline workflow failed');
  const baseline = await readProjection(prisma, recommendations, productId);
  settings.adviceEnabled = true;
  proxy.hook = options.beforeReply
    ? () => options.beforeReply!(prisma, productId)
    : undefined;
  const finalRun = await workflow.run(new Date(c.asOf), [productId]);
  proxy.hook = undefined;
  if (finalRun.evaluation.failed) throw new Error('Advice workflow failed');
  client.finish();
  const final = await readProjection(prisma, recommendations, productId);
  const attempt = await prisma.stockAdviceAttempt.findFirst({
    where: { productId },
    orderBy: { createdAt: 'desc' },
  });
  const accepted = !!(
    attempt?.response &&
    typeof attempt.response === 'object' &&
    !Array.isArray(attempt.response) &&
    attempt.response.accepted === true
  );
  const before = client.calls.length;
  if (attempt?.applicationStatus !== 'stale')
    await workflow.run(new Date(c.asOf), [productId]);
  client.finish();
  return workflowObservationSchema.parse({
    caseId: c.id,
    baseline,
    final,
    accepted,
    application: attempt?.applicationStatus ?? 'none',
    repeatInference: client.calls.length !== before,
    calls: client.calls,
  });
}
export async function runWorkflowEvaluation(
  value: unknown,
  options: WorkflowExecution,
): Promise<WorkflowObservation[]> {
  assertWorkflowDatabase(options.databaseUrl);
  const dataset = parseWorkflowDataset(value);
  if (options.recording)
    parseWorkflowRecording(options.recording, dataset, options.split);
  const cases = selectWorkflowCases(dataset, options.split);
  if (!cases.length) throw new Error('Empty workflow selection');
  if (!options.recording && (!options.typesafeApiKey || !options.budget))
    throw new Error('Live workflow needs credentials and explicit bounds');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: options.databaseUrl }),
  });
  let app: Awaited<ReturnType<typeof createWorkflowApp>> | undefined;
  try {
    await prisma.$connect();
    await assertEmptyDatabase(prisma);
    const settings = {
      enabled: false,
      cron: '0 0 1 1 *',
      timezone: 'UTC',
      adviceEnabled: false,
      adviceMaxProducts: 100,
    };
    const proxy = new WorkflowChoiceProxy({
      jevModel: options.model,
      typesafeApiKey: 'isolated-proxy',
    });
    app = await createWorkflowApp(prisma, settings, proxy, options.model);
    const rows: WorkflowObservation[] = [];
    for (const c of cases) {
      if (options.budget?.stopped || options.signal?.aborted) break;
      if (
        options.recording &&
        !options.recording.rows.some((r) => r.caseId === c.id)
      )
        continue;
      rows.push(
        await runCase(
          prisma,
          c,
          dataset,
          options,
          proxy,
          app.get(DailyStockWorkflowService),
          app.get(LowStockRecommendationService),
          settings,
        ),
      );
    }
    return rows;
  } finally {
    await app?.close();
    await prisma.$disconnect();
  }
}
async function createWorkflowApp(
  prisma: PrismaClient,
  settings: object,
  proxy: WorkflowChoiceProxy,
  model: string,
) {
  const config: ModelConfig = {
    llmProvider: 'openai',
    llmModel: 'evaluation-generation-disabled',
    productResolutionProvider: 'openai',
    productUnderstandingProvider: 'openai',
    shelfLifePolicyProvider: 'openai',
    stockPredictionProvider: 'typesafe',
    jevModel: model,
    typesafeApiKey: 'isolated-proxy',
  };
  const logger = new OperationalLogger();
  logger.stockWorkflow = () => undefined;
  logger.predictionRun = () => undefined;
  const module = await Test.createTestingModule({
    imports: [AppModule.register(config)],
  })
    .overrideProvider(ServiceAuthConfigService)
    .useValue({
      matches: (candidate: string) => candidate === 'evaluation-local-only',
    })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(STOCK_WORKFLOW_CONFIG)
    .useValue(settings)
    .overrideProvider(JevDecisionClient)
    .useValue(proxy)
    .overrideProvider(OperationalLogger)
    .useValue(logger)
    .overrideProvider(LLM_PROVIDER)
    .useValue({
      name: 'openai',
      generateStructured: async () => {
        throw new Error('Stock evaluation cannot generate');
      },
    })
    .overrideProvider(SHELF_LIFE_POLICY)
    .useValue({
      infer: async () => ({
        status: 'unresolved',
        outcome: { status: 'uncertain', reason: 'unknown' },
        taskVersion: 'workflow-frozen-policy-v1',
        attempts: [],
      }),
    })
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
