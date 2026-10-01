import {
  evaluationHash,
  parseEvaluationDataset,
  selectedInputHash,
  type EvaluationCase,
  type EvaluationDataset,
} from './dataset';
import {
  observationSchema,
  parseRecordedRun,
  type RecordedRun,
} from './observations';
import { ratioSchema } from './report-contract';
import { JEV_PRODUCT_RESOLUTION_VERSION } from '../../product/jev-product-resolution-advisor.service';

function fixture(
  id = 'milk',
  split: EvaluationCase['split'] = 'held_out',
): EvaluationCase {
  return {
    id,
    split,
    productGroupIds: [id],
    language: 'mixed',
    tags: ['typo_alias'],
    context: {
      requestedPhrase: '  ３％\tMILK ',
      candidates: [
        {
          id,
          canonicalName: '3% Milk',
          aliases: [],
          category: 'dairy',
          typicalUnit: 'liter',
          productType: null,
          isPerishable: true,
        },
      ],
    },
    expected: { kind: 'match', productId: id },
    label: {
      source: 'authored',
      rationale: 'Typo names the same item.',
      author: 'fixture-author',
      reviewStatus: 'pending',
    },
  };
}

function dataset(cases = [fixture()]): EvaluationDataset {
  return { schemaVersion: 1, datasetVersion: 'test-v1', cases };
}

function recording(input: EvaluationDataset): RecordedRun {
  return {
    schemaVersion: 1,
    evidenceMode: 'offline',
    datasetHash: evaluationHash(input),
    inputHash: selectedInputHash(input.cases),
    split: 'held_out',
    configuredModel: 'jev-1.13.0',
    rows: input.cases.map((item) => ({
      caseId: item.id,
      elapsedMs: 10,
      transport: {
        status: 'success',
        provider: 'typesafe',
        task: 'product_resolution',
        taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
        model: 'jev-1.13.0',
        choice: 'candidate_0',
        confidence: 0.9,
        probabilities: { candidate_0: 0.95, ambiguous: 0.03, no_match: 0.02 },
        usage: { input_tokens: 100, output_tokens: 10 },
      },
    })),
  };
}

describe('recorded evaluation contracts', () => {
  it('accepts a bound replay validated with the production transport validator', () => {
    const input = parseEvaluationDataset(dataset());
    expect(
      parseRecordedRun(recording(input), input, 'held_out').rows,
    ).toHaveLength(1);
  });

  it.each([
    'foreign',
    'missing',
    'duplicate',
    'hash',
    'split',
    'invalid choice',
    'padded choice',
    'probability sum',
    'non-max choice',
    'skipped call',
  ] as const)('rejects %s replay', (kind) => {
    const input = parseEvaluationDataset(dataset());
    const run = recording(input);
    if (kind === 'foreign') run.rows[0].caseId = 'other';
    if (kind === 'missing') run.rows = [];
    if (kind === 'duplicate') run.rows.push(run.rows[0]);
    if (kind === 'hash') run.inputHash = '0'.repeat(64);
    if (kind === 'split') run.split = 'tuning';
    if (kind === 'skipped call') run.rows[0].transport = null;
    const transport = run.rows[0]?.transport;
    if (transport?.status === 'success') {
      if (kind === 'invalid choice') transport.choice = 'unknown';
      if (kind === 'padded choice') transport.choice = ' candidate_0 ';
      if (kind === 'probability sum') transport.probabilities.candidate_0 = 0.2;
      if (kind === 'non-max choice') transport.choice = 'no_match';
    }
    expect(() => parseRecordedRun(run, input, 'held_out')).toThrow();
  });

  it('accepts skipped empty candidates and whitelisted failures without raw error content', () => {
    const item = fixture();
    item.context.candidates = [];
    item.expected = { kind: 'no_match' };
    const input = parseEvaluationDataset(dataset([item]));
    const run = recording(input);
    run.rows[0].transport = null;
    expect(
      parseRecordedRun(run, input, 'held_out').rows[0].transport,
    ).toBeNull();
    const nonempty = parseEvaluationDataset(dataset());
    const failed = recording(nonempty);
    failed.rows[0].transport = {
      status: 'unavailable',
      provider: 'typesafe',
      task: 'product_resolution',
      taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
      reason: 'network_error',
    };
    expect(
      parseRecordedRun(failed, nonempty, 'held_out').rows[0].transport?.status,
    ).toBe('unavailable');
    expect(() =>
      parseRecordedRun(
        { ...failed, rawError: 'private' },
        nonempty,
        'held_out',
      ),
    ).toThrow();
  });
});

describe('observation and report contracts', () => {
  const observation = {
    caseId: 'milk',
    elapsedMs: 10,
    configuredModel: 'jev-1.13.0',
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    callStatus: 'success',
    resolvedModel: 'jev-1.13.0',
    decision: { choice: 'candidate_0', confidence: 0.9 },
    usage: { input_tokens: 100, output_tokens: 10 },
    unavailableReason: null,
    proposal: {
      recommendation: 'add_alias',
      targetProductId: 'milk',
      confidence: 0.9,
    },
  };

  it('allows only safe projections of accepted proposals', () => {
    expect(observationSchema.safeParse(observation).success).toBe(true);
    expect(
      observationSchema.safeParse({
        ...observation,
        proposal: {
          ...observation.proposal,
          alias: 'private requested phrase',
        },
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        ...observation,
        proposal: { ...observation.proposal, confidence: 0.8999 },
      }).success,
    ).toBe(false);
  });

  it('rejects a proposal with a different confidence or a noncandidate choice', () => {
    for (const decision of [
      { choice: 'candidate_0', confidence: 0.8 },
      { choice: 'no_match', confidence: 0.9 },
      { choice: 'ambiguous', confidence: 0.9 },
    ]) {
      expect(
        observationSchema.safeParse({ ...observation, decision }).success,
      ).toBe(false);
    }
  });

  it('rejects failure observations claiming a proposal, and nonfinite usage/latency', () => {
    expect(
      observationSchema.safeParse({ ...observation, elapsedMs: Infinity })
        .success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        ...observation,
        usage: { input_tokens: -1, output_tokens: 10 },
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        ...observation,
        callStatus: 'unavailable',
        decision: null,
        resolvedModel: null,
        usage: null,
        unavailableReason: 'network_error',
      }).success,
    ).toBe(false);
  });

  it('locks exact denominators and null metrics for zero samples', () => {
    expect(
      ratioSchema.safeParse({ numerator: 0, denominator: 0, value: null })
        .success,
    ).toBe(true);
    expect(
      ratioSchema.safeParse({ numerator: 1, denominator: 2, value: 0.5 })
        .success,
    ).toBe(true);
    expect(
      ratioSchema.safeParse({ numerator: 0, denominator: 0, value: 1 }).success,
    ).toBe(false);
    expect(
      ratioSchema.safeParse({ numerator: 1, denominator: 2, value: 1 }).success,
    ).toBe(false);
  });
});
