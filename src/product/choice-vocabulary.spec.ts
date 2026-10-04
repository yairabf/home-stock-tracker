import {
  buildChoiceVocabulary,
  resolveVocabularyChoice,
  VOCABULARY_MAX_CONTEXT_BYTES,
  type ChoiceVocabularyInput,
  type CompleteChoiceVocabulary,
} from './choice-vocabulary';
import type { JevJsonObject } from '../llm/typesafe/jev-decision.types';

function complete(
  input: Partial<ChoiceVocabularyInput> = {},
): CompleteChoiceVocabulary {
  const result = buildChoiceVocabulary({
    kind: 'category',
    labels: ['Dairy'],
    context: {},
    ...input,
  });
  if (result.status !== 'complete')
    throw new Error('Expected complete vocabulary');
  return result;
}

describe('choice vocabulary', () => {
  it.each(['category', 'unit'] as const)(
    'bootstraps empty %s input with versioned seeds and unknown',
    (kind) => {
      const vocabulary = complete({ kind, labels: [] });
      const labels = Object.values(vocabulary.values).filter(
        (value) => value !== null,
      );
      expect(labels.length).toBe(kind === 'category' ? 12 : 6);
      expect(labels).toContain(kind === 'category' ? 'dairy and eggs' : 'item');
      expect(vocabulary.version).toBe(`product-${kind}-v1`);
      expect(resolveVocabularyChoice(vocabulary, 'unknown')).toEqual({
        status: 'unknown',
      });
    },
  );

  it('uses existing labels without adding seeds or translating stored display values', () => {
    const labels = ['מוצרי חלב', '  Bakery  ', 'Household', 'מוצרי חלב'];
    const vocabulary = complete({ labels });
    expect(Object.values(vocabulary.values)).toEqual([
      null,
      '  Bakery  ',
      'Household',
      'מוצרי חלב',
    ]);
    expect(Object.keys(vocabulary.criteria)).toEqual(
      Object.keys(vocabulary.values),
    );
    expect(resolveVocabularyChoice(vocabulary, 'choice_2')).toEqual({
      status: 'resolved',
      value: 'מוצרי חלב',
    });
    expect(vocabulary.criteria.choice_2).toEqual({ label: 'מוצרי חלב' });
  });

  it('keeps custom explicit unit vocabulary instead of restricting it to seed units', () => {
    expect(
      Object.values(
        complete({ kind: 'unit', labels: ['carton', 'קופסה'] }).values,
      ),
    ).toEqual([null, 'carton', 'קופסה']);
  });

  it('deduplicates exact labels and orders choices independently of input order', () => {
    const first = complete({ labels: ['Rice', 'Milk', 'Rice'] });
    const second = complete({ labels: ['Milk', 'Rice'] });
    expect(first).toEqual(second);
  });

  it.each([
    ['Dairy', 'dairy'],
    ['Dairy', ' Dairy '],
    ['Personal Care', 'Personal   Care'],
    ['KG', 'ＫＧ'],
    ['מוצרי חלב', 'מוצרי\tחלב'],
  ])(
    'returns ambiguity rather than silently merging distinct normalized labels %#',
    (...labels) => {
      expect(
        buildChoiceVocabulary({ kind: 'category', labels, context: {} }),
      ).toEqual({ status: 'unsupported', reason: 'ambiguous_labels' });
    },
  );

  it('preserves labels resembling reserved/prototype tokens as opaque option values', () => {
    const vocabulary = complete({
      labels: ['unknown', 'choice_0', '__proto__', 'constructor'],
    });
    expect(Object.values(vocabulary.values)).toContain('__proto__');
    const unknownLabelToken = Object.keys(vocabulary.values).find(
      (token) => vocabulary.values[token] === 'unknown',
    );
    expect(resolveVocabularyChoice(vocabulary, unknownLabelToken)).toEqual({
      status: 'resolved',
      value: 'unknown',
    });
    expect(resolveVocabularyChoice(vocabulary, 'unknown')).toEqual({
      status: 'unknown',
    });
    expect(resolveVocabularyChoice(vocabulary, '__proto__')).toEqual({
      status: 'invalid_choice',
    });
    expect(resolveVocabularyChoice(vocabulary, 'constructor')).toEqual({
      status: 'invalid_choice',
    });
  });

  it.each([null, 0, '', 'unrequested', 'choice_999'])(
    'rejects unrequested answer tokens %#',
    (token) => {
      expect(resolveVocabularyChoice(complete(), token)).toEqual({
        status: 'invalid_choice',
      });
    },
  );

  it('allows 254 domain options plus unknown', () => {
    const vocabulary = complete({
      labels: Array.from({ length: 254 }, (_, index) => `c${index}`),
    });
    expect(Object.keys(vocabulary.criteria)).toHaveLength(255);
  });

  it('returns no partial mapping when 255 domain options are supplied', () => {
    const result = buildChoiceVocabulary({
      kind: 'category',
      context: {},
      labels: Array.from({ length: 255 }, (_, index) => `c${index}`),
    });
    expect(result).toEqual({
      status: 'unsupported',
      reason: 'too_many_options',
    });
  });

  it('includes option labels and evidence in UTF-8 byte accounting', () => {
    const vocabulary = complete({
      labels: ['חלב', '🛒'],
      context: { name: 'חלב 🛒' },
    });
    expect(vocabulary.contextBytes).toBe(
      Buffer.byteLength(
        JSON.stringify({
          state: vocabulary.state,
          criteria: vocabulary.criteria,
        }),
        'utf8',
      ),
    );
    expect(vocabulary.contextBytes).toBeGreaterThan(
      JSON.stringify({ state: vocabulary.state, criteria: vocabulary.criteria })
        .length,
    );
  });

  it('accepts the exact byte limit and rejects one byte over', () => {
    const base = complete({ context: { padding: '' } });
    const padding = 'x'.repeat(
      VOCABULARY_MAX_CONTEXT_BYTES - base.contextBytes,
    );
    expect(complete({ context: { padding } }).contextBytes).toBe(
      VOCABULARY_MAX_CONTEXT_BYTES,
    );
    expect(
      buildChoiceVocabulary({
        kind: 'category',
        labels: ['Dairy'],
        context: { padding: `${padding}x` },
      }),
    ).toEqual({ status: 'unsupported', reason: 'context_too_large' });
  });

  it('rejects oversized criteria even with empty evidence', () => {
    expect(
      buildChoiceVocabulary({
        kind: 'category',
        labels: ['🛒'.repeat(4096)],
        context: {},
      }),
    ).toEqual({ status: 'unsupported', reason: 'context_too_large' });
  });

  it('leaves input labels/context unchanged', () => {
    const labels = Object.freeze(['Rice', 'Milk']);
    const context = Object.freeze({ name: 'milk' });
    const snapshot = structuredClone({ labels, context });
    complete({ labels, context });
    expect({ labels, context }).toEqual(snapshot);
  });

  it('isolates returned evidence from subsequent input changes', () => {
    const context = { product: { name: 'milk' } };
    const vocabulary = complete({ context });
    context.product.name = 'rice';
    expect(vocabulary.state).toEqual({
      evidence: { product: { name: 'milk' } },
    });
    const evidence = vocabulary.state.evidence as JevJsonObject;
    evidence.product = null;
    expect(context.product.name).toBe('rice');
  });

  it.each([
    null,
    {},
    { kind: 'unsupported', labels: [], context: {} },
    ...['', '   ', '\t', null, 42].map((label) => ({
      kind: 'category',
      labels: [label],
      context: {},
    })),
    ...[
      null,
      [],
      'text',
      { value: undefined },
      { value: NaN },
      { value: Infinity },
      { value: () => 'x' },
      new Date(),
    ].map((context) => ({ kind: 'category', labels: ['Dairy'], context })),
  ])('fails closed for invalid builder input %#', (input) => {
    expect(buildChoiceVocabulary(input as ChoiceVocabularyInput)).toEqual({
      status: 'unsupported',
      reason: 'invalid_input',
    });
  });

  it('rejects cyclic state before serialization', () => {
    const context: JevJsonObject = {};
    context.self = context;
    expect(
      buildChoiceVocabulary({ kind: 'category', labels: [], context }),
    ).toEqual({ status: 'unsupported', reason: 'invalid_input' });
  });

  it('rejects accessor state without evaluating the accessor', () => {
    const getter = jest.fn(() => {
      throw new Error('private failure');
    });
    const context = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get: getter,
    });
    expect(
      buildChoiceVocabulary({ kind: 'category', labels: [], context }),
    ).toEqual({ status: 'unsupported', reason: 'invalid_input' });
    expect(getter).not.toHaveBeenCalled();
  });
});
