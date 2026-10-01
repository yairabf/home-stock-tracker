import { PredictedState } from '../generated/prisma/enums';
import { JevDecisionClient } from '../llm/typesafe/jev-decision.client';
import type { JevChoiceRequest } from '../llm/typesafe/jev-decision.types';
import {
  JevStockPredictionAdvisor,
  JEV_STOCK_MAX_EVIDENCE_BYTES,
} from './jev-stock-prediction-advisor.service';
import { stockCandidate } from './stock-prediction.fixture';

describe('JevStockPredictionAdvisor', () => {
  let fetcher: jest.MockedFunction<typeof fetch>;
  let advisor: JevStockPredictionAdvisor;
  let state: string;
  let confidence: number;
  beforeEach(() => {
    state = 'probably_low';
    confidence = 0.95;
    fetcher = jest
      .fn()
      .mockImplementation(
        (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
          const body = JSON.parse(init?.body as string) as {
            questions: { stock_state: { criteria: Record<string, unknown> } };
          };
          return Promise.resolve(
            new Response(
              JSON.stringify({
                model: 'jev-1.14.0',
                answers: {
                  stock_state: {
                    type: 'choice',
                    choice: state,
                    confidence,
                    probabilities: Object.fromEntries(
                      Object.keys(body.questions.stock_state.criteria).map(
                        (key) => [key, key === state ? 1 : 0],
                      ),
                    ),
                  },
                },
                usage: { input_tokens: 10, output_tokens: 2 },
              }),
              { status: 200 },
            ),
          );
        },
      );
    advisor = new JevStockPredictionAdvisor(
      new JevDecisionClient(
        { typesafeApiKey: 'fixture-key', jevModel: 'jev-1.13.0' },
        fetcher,
      ),
    );
  });

  it.each(Object.values(PredictedState))(
    'maps %s with actual resolved provenance and no action',
    async (choice) => {
      state = choice;
      expect(await advisor.reason(stockCandidate())).toMatchObject({
        status: 'success',
        provider: 'typesafe',
        model: 'jev-1.14.0',
        taskVersion: 'jev-stock-prediction-v1',
        value: {
          predictedState: choice,
          confidence: 0.95,
          recommendedAction: null,
        },
      });
    },
  );

  it.each([0, 0.89999, 0.9, 1])(
    'retains validated confidence %s for service acceptance policy',
    async (score) => {
      confidence = score;
      expect(await advisor.reason(stockCandidate())).toMatchObject({
        status: 'success',
        value: { confidence: score },
      });
    },
  );

  it('sends enum choices and minimized evidence without private household fields', async () => {
    await advisor.reason(stockCandidate());
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string) as {
      state: unknown;
      questions: { stock_state: { criteria: Record<string, unknown> } };
    };
    expect(Object.keys(body.questions.stock_state.criteria)).toEqual(
      Object.values(PredictedState),
    );
    expect(body.state).toMatchObject({
      signals: {
        lastPurchaseAt: '2026-09-20T10:00:00.000Z',
        householdContext: { adultsCount: 2, childrenCount: 3 },
      },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /private-age-group|private-preference|childAgeGroups|predictionPreferences/,
    );
  });

  it('passes the stock task and version to the shared transport', async () => {
    const client = new JevDecisionClient({});
    const spy = jest.spyOn(client, 'choose');
    spy.mockResolvedValue({
      status: 'unavailable',
      provider: 'typesafe',
      task: 'stock_prediction',
      taskVersion: 'jev-stock-prediction-v1',
      reason: 'not_configured',
    });
    await new JevStockPredictionAdvisor(client).reason(stockCandidate());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining<Partial<JevChoiceRequest>>({
        task: 'stock_prediction',
        taskVersion: 'jev-stock-prediction-v1',
        questionKey: 'stock_state',
      }),
    );
  });

  it.each([NaN, Infinity, -1, 2])(
    'rejects invalid input confidence %s without requests',
    async (score) => {
      await expect(
        advisor.reason({ ...stockCandidate(), confidenceScore: score }),
      ).resolves.toEqual({ status: 'unavailable' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('rejects oversized UTF-8 evidence rather than truncating it', async () => {
    const candidate = stockCandidate();
    candidate.signals.predictionStrategy = 'ח'.repeat(
      JEV_STOCK_MAX_EVIDENCE_BYTES / 2,
    );
    await expect(advisor.reason(candidate)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['unknown', '__proto__'])(
    'rejects invalid choice %s',
    async (choice) => {
      state = choice;
      await expect(advisor.reason(stockCandidate())).resolves.toEqual({
        status: 'unavailable',
      });
    },
  );

  it('isolates network exceptions', async () => {
    fetcher.mockRejectedValue(new Error('private provider error'));
    await expect(advisor.reason(stockCandidate())).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
