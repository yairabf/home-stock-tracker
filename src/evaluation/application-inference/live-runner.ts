import OpenAI from 'openai';
import { OpenAiLlmProvider } from '../../llm/openai/openai-llm.provider';
import { OperationalLogger } from '../../observability/operational-logger.service';
import { DEFAULT_OPENAI_MODEL } from '../../llm/openai/openai.tokens';
import { requiresUnsupportedGeneration } from '../../inventory/shelf-life-policy-registry';
import { ChoiceRecorder } from './choice-recorder';
import { GenerationRecorder } from './generation-recorder';
import { observeUnderstanding } from './understanding-runner';
import { observePolicy } from './policy-runner';
import { observationSchema, type Observation } from './observations';
import { modelSchema, type ApplicationCase } from './dataset';
import { RequestBudget } from './request-budget';

export function worstCaseRequests(cases: ApplicationCase[]): number {
  return cases.reduce(
    (sum, c) =>
      sum +
      (c.task === 'product_understanding'
        ? Object.values(c.input.metadata).filter((v) => v === null).length * 2
        : requiresUnsupportedGeneration(c.input)
          ? 1
          : 2),
    0,
  );
}
export function liveConfiguration(
  environment: NodeJS.ProcessEnv,
  cases: ApplicationCase[],
) {
  const typesafeApiKey = environment.TYPESAFE_API_KEY?.trim();
  const model = modelSchema.safeParse(environment.JEV_MODEL?.trim());
  if (!typesafeApiKey || !model.success)
    throw new Error(
      'Live evaluation needs private TypeSafe credentials and an exact JEV pin',
    );
  const needsGeneration = cases.some(
    (c) =>
      c.task === 'shelf_life_policy' && requiresUnsupportedGeneration(c.input),
  );
  const openaiKey = environment.OPENAI_API_KEY?.trim();
  if (needsGeneration && !openaiKey)
    throw new Error(
      'Selected required generation needs private OpenAI credentials',
    );
  const openaiModel = environment.LLM_MODEL?.trim() ?? DEFAULT_OPENAI_MODEL;
  if (!openaiModel) throw new Error('Invalid configured generation model');
  return {
    typesafeApiKey,
    jevModel: model.data,
    openaiKey: needsGeneration ? openaiKey : undefined,
    openaiModel,
  };
}
export async function runLive(
  cases: ApplicationCase[],
  config: ReturnType<typeof liveConfiguration>,
  budget: RequestBudget,
  fetcher?: typeof fetch,
) {
  const rows: Observation[] = [];
  const openai = config.openaiKey
    ? new OpenAI({
        apiKey: config.openaiKey,
        maxRetries: 0,
        fetch: budget.fetch('openai', fetcher),
      })
    : null;
  const logger = new OperationalLogger();
  // CLI diagnostics are aggregate-only; the provider already maps errors to safe outcomes.
  logger.llmIntegration = () => undefined;
  const provider = new OpenAiLlmProvider(openai, config.openaiModel, logger);
  for (const c of cases) {
    if (budget.stopped) break;
    const client = new ChoiceRecorder(
      config.jevModel,
      undefined,
      config,
      budget.fetch('typesafe', fetcher),
    );
    const output =
      c.task === 'product_understanding'
        ? await observeUnderstanding(c, client)
        : await observePolicy(
            c,
            client,
            new GenerationRecorder(undefined, provider),
          );
    rows.push(observationSchema.parse({ task: c.task, ...output }));
  }
  return rows;
}
