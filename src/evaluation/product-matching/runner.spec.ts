import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEvaluationDataset, type EvaluationDataset } from './dataset';
import { executeEvaluation, liveConfiguration } from './runner';
import type { RecordedRun } from './observations';

const corpus = resolve(__dirname, '../../../evaluation/product-matching/');
function fixtures() {
  return {
    dataset: parseEvaluationDataset(
      JSON.parse(readFileSync(resolve(corpus, 'cases.v1.json'), 'utf8')),
    ),
    recorded: JSON.parse(
      readFileSync(resolve(corpus, 'recorded-smoke.v1.json'), 'utf8'),
    ) as RecordedRun,
  };
}
function smallDataset(): EvaluationDataset {
  const { dataset } = fixtures();
  dataset.cases = dataset.cases
    .filter((item) => item.split === 'held_out')
    .slice(0, 2);
  return dataset;
}
const environment = {
  TYPESAFE_API_KEY: 'fake-test-key',
  JEV_MODEL: 'jev-1.13.0',
};
function response(body: string, confidence = 0.95) {
  const payload = JSON.parse(body) as {
    questions: { product_match: { criteria: Record<string, unknown> } };
  };
  return new Response(
    JSON.stringify({
      model: 'jev-1.13.0',
      answers: {
        product_match: {
          type: 'choice',
          choice: 'candidate_0',
          confidence,
          probabilities: Object.fromEntries(
            Object.keys(payload.questions.product_match.criteria).map((key) => [
              key,
              key === 'candidate_0' ? 1 : 0,
            ]),
          ),
        },
      },
      usage: { input_tokens: 10, output_tokens: 1 },
    }),
  );
}
describe('bounded matching execution', () => {
  it('replays through the real advisor with zero fetch calls and no live eligibility', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Must stay offline'));
    try {
      const { dataset, recorded } = fixtures();
      const report = await executeEvaluation(dataset, 'held_out', {
        mode: 'offline',
        recorded,
      });
      expect(report.metrics.precision).toMatchObject({
        numerator: 60,
        denominator: 60,
        value: 1,
      });
      expect(report.launchEvidence).toBe('inconclusive');
      expect(fetcher).not.toHaveBeenCalled();
      expect(JSON.stringify(report)).not.toContain('requestedPhrase');
      expect(JSON.stringify(report)).not.toContain('canonicalName');
    } finally {
      fetcher.mockRestore();
    }
  });
  it('uses production mapping at .9 and abstains below it without sending labels', async () => {
    const dataset = smallDataset();
    let n = 0;
    const fetcher = jest.fn((_url: unknown, init?: RequestInit) => {
      const body = init!.body as string;
      const payload = JSON.parse(body) as { state: Record<string, unknown> };
      expect(Object.keys(payload.state).sort()).toEqual([
        'candidates',
        'requestedPhrase',
      ]);
      expect(body).not.toContain('reviewStatus');
      expect(body).not.toContain('expected');
      return Promise.resolve(response(body, n++ === 0 ? 0.9 : 0.8999));
    });
    const report = await executeEvaluation(dataset, 'held_out', {
      mode: 'live',
      environment,
      fetcher,
    });
    expect(report.observations[0].proposal?.recommendation).toBe('add_alias');
    expect(report.observations[1].proposal).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('stops serial execution after interruption and emits an incomplete report', async () => {
    const controller = new AbortController();
    const fetcher = jest.fn((_url: unknown, init?: RequestInit) => {
      controller.abort();
      return Promise.resolve(response(init!.body as string));
    });
    const report = await executeEvaluation(
      smallDataset(),
      'held_out',
      { mode: 'live', environment, fetcher },
      { signal: controller.signal },
    );
    expect(report.complete).toBe(false);
    expect(report.observations).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves safe provider failure reasons in coverage and blocks live configuration without credentials', async () => {
    expect(() => liveConfiguration({})).toThrow();
    expect(() =>
      liveConfiguration({ ...environment, JEV_MODEL: 'jev-latest' }),
    ).toThrow();
    const report = await executeEvaluation(smallDataset(), 'held_out', {
      mode: 'live',
      environment,
      fetcher: jest.fn().mockResolvedValue(new Response('', { status: 401 })),
    });
    expect(report.metrics.failureReasons.authentication_error).toBe(2);
    expect(report.metrics.coverage.denominator).toBe(2);
  });
});
