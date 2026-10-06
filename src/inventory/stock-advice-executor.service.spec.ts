import { StockAdviceExecutor } from './stock-advice-executor.service';
import { stockCandidate } from '../estimation/stock-prediction.fixture';
import type { DailyAdviceBaseline } from './stock-advice-policy';

const baseline: DailyAdviceBaseline = {
  productId: 'p',
  projectionId: 'proj',
  revision: 1,
  predictionId: 'pred',
  evaluatedAt: new Date(),
  estimatedQuantity: null,
  estimatedState: 'uncertain',
  confidence: 0.6,
  reason: 'daily_stock_uncertain',
};
const advice = {
  status: 'success',
  provider: 'typesafe',
  model: 'jev-1.14.0',
  taskVersion: 'jev-stock-prediction-v1',
  value: {
    predictedState: 'probably_low',
    confidence: 0.9,
    reason: 'Bounded evidence',
    recommendedAction: null,
  },
};

describe('StockAdviceExecutor', () => {
  const updateMany = jest.fn();
  const reserve = jest.fn();
  const read = jest.fn();
  const reason = jest.fn();
  const model = { stockPredictionProvider: 'typesafe', jevModel: 'jev-1.13.0' };
  const workflow = { adviceEnabled: true };
  const service = new StockAdviceExecutor(
    { stockAdviceAttempt: { updateMany } } as never,
    { reserve } as never,
    { read } as never,
    { provider: 'typesafe', reason } as never,
    model as never,
    workflow as never,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    model.stockPredictionProvider = 'typesafe';
    workflow.adviceEnabled = true;
    read.mockResolvedValue({ fingerprint: 'f', candidate: stockCandidate() });
    reserve.mockResolvedValue({ owned: true, attempt: { id: 'a' } });
    updateMany.mockResolvedValue({ count: 1 });
    reason.mockResolvedValue(advice);
  });
  it('accepts the boundary and conservatively composes quantity-free advice', async () => {
    await expect(service.execute(baseline)).resolves.toMatchObject({
      accepted: true,
      result: {
        predictedState: 'probably_low',
        confidenceScore: 0.6,
        recommendedAction: null,
      },
    });
    expect(updateMany).toHaveBeenCalledWith(
      containing({
        data: containing({
          status: 'completed',
          resolvedModel: 'jev-1.14.0',
        }),
      }),
    );
  });
  it.each([
    { ...advice.value, confidence: 0.899 },
    { ...advice.value, predictedState: 'uncertain' },
  ])('records rejected valid advice %p', async (value) => {
    reason.mockResolvedValue({ ...advice, value });
    await expect(service.execute(baseline)).resolves.toMatchObject({
      accepted: false,
      result: { predictedState: 'uncertain', confidenceScore: 0.6 },
    });
  });
  it.each([
    null,
    { status: 'unavailable' },
    { ...advice, provider: 'openai' },
    { ...advice, value: { ...advice.value, confidence: 5 } },
  ])('fails safely for %p', async (response) => {
    reason.mockResolvedValue(response);
    await expect(service.execute(baseline)).resolves.toMatchObject({
      accepted: false,
      advice: null,
    });
    expect(reason).toHaveBeenCalledTimes(1);
  });
  it('isolates thrown provider errors', async () => {
    reason.mockRejectedValue(new Error('secret error'));
    await expect(service.execute(baseline)).resolves.toMatchObject({
      advice: null,
    });
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain('secret');
  });
  it('fails closed before inference if reservation persistence fails', async () => {
    reserve.mockRejectedValue(new Error('db'));
    await expect(service.execute(baseline)).rejects.toThrow('db');
    expect(reason).not.toHaveBeenCalled();
  });
  it('does not publish if completed response persistence fails', async () => {
    updateMany.mockRejectedValue(new Error('db'));
    await expect(service.execute(baseline)).rejects.toThrow('db');
  });
  it('reuses validated completed advice without a call', async () => {
    reserve.mockResolvedValue({
      owned: false,
      attempt: {
        id: 'a',
        status: 'completed',
        response: { accepted: true, advice },
      },
    });
    await expect(service.execute(baseline)).resolves.toMatchObject({
      accepted: true,
    });
    expect(reason).not.toHaveBeenCalled();
  });
  it.each(['reserved', 'unavailable', 'abandoned'])(
    'does not retry %s',
    async (status) => {
      reserve.mockResolvedValue({ owned: false, attempt: { id: 'a', status } });
      await expect(service.execute(baseline)).resolves.toBeNull();
      expect(reason).not.toHaveBeenCalled();
    },
  );
  it('does not call when disabled or selected OpenAI', async () => {
    workflow.adviceEnabled = false;
    await expect(service.execute(baseline)).resolves.toBeNull();
    workflow.adviceEnabled = true;
    model.stockPredictionProvider = 'openai';
    await expect(service.execute(baseline)).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(reason).not.toHaveBeenCalled();
  });
});

function containing(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value) as unknown;
}
