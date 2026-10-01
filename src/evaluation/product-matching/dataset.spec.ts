import {
  evaluationHash,
  inspectDataset,
  parseEvaluationDataset,
  REQUIRED_SCENARIO_TAGS,
  selectedInputHash,
  type EvaluationCase,
  type EvaluationDataset,
} from './dataset';

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

describe('evaluation dataset validation', () => {
  it('requires sample sizes, Hebrew coverage and scenario representation in both splits', () => {
    const cases = Array.from({ length: 100 }, (_, index) => {
      const item = fixture(`case-${index}`, index < 40 ? 'tuning' : 'held_out');
      item.language = index < 30 ? 'hebrew' : 'other';
      item.tags = [...REQUIRED_SCENARIO_TAGS];
      return item;
    });
    const valid = parseEvaluationDataset(dataset(cases));
    expect(inspectDataset(valid).corpusEligible).toBe(true);
    expect(inspectDataset(dataset(cases.slice(1))).corpusEligible).toBe(false);
    const belowLanguageCount = structuredClone(valid);
    belowLanguageCount.cases[0].language = 'other';
    expect(inspectDataset(belowLanguageCount).corpusEligible).toBe(false);
    const missingTag = structuredClone(valid);
    for (const item of missingTag.cases.filter(
      (item) => item.split === 'tuning',
    ))
      item.tags = item.tags.filter((tag) => tag !== 'related_distinct');
    expect(inspectDataset(missingTag)).toMatchObject({
      corpusEligible: false,
      missingScenarios: ['tuning:related_distinct'],
    });
    const fewerHeldOut = structuredClone(valid);
    fewerHeldOut.cases[40].split = 'tuning';
    expect(inspectDataset(fewerHeldOut).corpusEligible).toBe(false);
  });

  it('uses production normalization and reports honest corpus/review status', () => {
    const parsed = parseEvaluationDataset(dataset());
    expect(parsed.cases[0].context.requestedPhrase).toBe('3% milk');
    expect(inspectDataset(parsed)).toMatchObject({
      caseCount: 1,
      splitCounts: { tuning: 0, held_out: 1 },
      hebrewMixedCount: 1,
      reviewedCount: 0,
      confirmedCount: 0,
      corpusEligible: false,
      labelsReviewed: false,
      tagCounts: { typo_alias: 1 },
    });
  });

  it('accepts an empty-candidate no-match but rejects a match with no candidate', () => {
    const item = fixture();
    item.context.candidates = [];
    expect(() => parseEvaluationDataset(dataset([item]))).toThrow();
    item.expected = { kind: 'no_match' };
    expect(parseEvaluationDataset(dataset([item])).cases[0].expected.kind).toBe(
      'no_match',
    );
  });

  it.each(['group', 'candidate'] as const)(
    'rejects cross-split %s leakage',
    (kind) => {
      const a = fixture('a', 'tuning');
      const b = fixture('b');
      if (kind === 'group') b.productGroupIds = ['a'];
      else {
        b.context.candidates[0].id = 'a';
        b.expected = { kind: 'match', productId: 'a' };
      }
      expect(() => parseEvaluationDataset(dataset([a, b]))).toThrow();
    },
  );

  it.each([
    ['duplicate cases', (item: EvaluationCase) => dataset([item, item])],
    [
      'duplicate candidates',
      (item: EvaluationCase) => {
        item.context.candidates.push(item.context.candidates[0]);
        return dataset([item]);
      },
    ],
    [
      'absent target',
      (item: EvaluationCase) => {
        item.expected = { kind: 'match', productId: 'absent' };
        return dataset([item]);
      },
    ],
    [
      'duplicate ambiguity IDs',
      (item: EvaluationCase) => {
        item.expected = {
          kind: 'ambiguous',
          plausibleProductIds: ['milk', 'milk'],
        };
        return dataset([item]);
      },
    ],
    [
      'unreviewed confirmed source',
      (item: EvaluationCase) => {
        item.label.source = 'confirmed';
        return dataset([item]);
      },
    ],
    [
      'self review',
      (item: EvaluationCase) => {
        item.label = {
          ...item.label,
          reviewStatus: 'reviewed',
          reviewer: item.label.author,
          reviewedAt: '2026-10-01T08:00:00Z',
        };
        return dataset([item]);
      },
    ],
    [
      'missing review date',
      (item: EvaluationCase) => {
        item.label = {
          ...item.label,
          reviewStatus: 'reviewed',
          reviewer: 'another-reviewer',
        };
        return dataset([item]);
      },
    ],
    [
      'pending reviewer',
      (item: EvaluationCase) => {
        item.label.reviewer = 'another-reviewer';
        return dataset([item]);
      },
    ],
    [
      'byte overflow',
      (item: EvaluationCase) => {
        item.context.candidates[0].aliases = Array.from({ length: 100 }, () =>
          'א'.repeat(100),
        );
        return dataset([item]);
      },
    ],
  ] as const)('rejects %s', (_name, mutate) => {
    expect(() => parseEvaluationDataset(mutate(fixture()))).toThrow(
      'Invalid product-matching dataset',
    );
  });

  it('rejects malformed/oversized contexts and unknown fields', () => {
    for (const context of [
      null,
      { requestedPhrase: '', candidates: [] },
      {
        requestedPhrase: 'milk',
        candidates: Array(21).fill(fixture().context.candidates[0]),
      },
    ]) {
      expect(() =>
        parseEvaluationDataset({
          ...dataset(),
          cases: [{ ...fixture(), context }],
        }),
      ).toThrow();
    }
    expect(() =>
      parseEvaluationDataset({ ...dataset(), apiKey: 'not-a-real-key' }),
    ).toThrow();
  });

  it('keeps labels independently reviewed only with complete distinct reviewer metadata', () => {
    const item = fixture();
    item.label = {
      ...item.label,
      reviewStatus: 'reviewed',
      reviewer: 'independent-reviewer',
      reviewedAt: '2026-10-01T08:00:00Z',
    };
    expect(
      inspectDataset(parseEvaluationDataset(dataset([item]))).labelsReviewed,
    ).toBe(true);
  });

  it('canonical hashes ignore object key order but bind candidate order and label changes', () => {
    expect(evaluationHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      evaluationHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(evaluationHash([1, 2])).not.toBe(evaluationHash([2, 1]));
    const parsed = parseEvaluationDataset(dataset());
    const before = evaluationHash(parsed);
    const inputs = selectedInputHash(parsed.cases);
    parsed.cases[0].label.rationale = 'A different label rationale';
    expect(evaluationHash(parsed)).not.toBe(before);
    expect(selectedInputHash(parsed.cases)).toBe(inputs);
  });
});
