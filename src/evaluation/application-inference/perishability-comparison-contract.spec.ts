import { hash, parseDataset } from './dataset';
import {
  comparisonBinding,
  parsePerishabilityComparison,
  type RequestDefinition,
} from './perishability-comparison-contract';
import { orderedRequestHash } from './perishability-request-capture';
import type { JevChoiceRequest } from '../../llm/typesafe/jev-decision.types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const definitions: RequestDefinition[] = [
  {
    variantId: 'baseline',
    codeRevision: 'a'.repeat(40),
    configuredModel: 'jev-1.13.0',
    adapterVersion: 'jev-product-understanding-v1',
    questionVersion: 'isPerishable-choices-v1',
    captureMode: 'reconstructed',
  },
];
function fixture() {
  const dataset = parseDataset({
    schemaVersion: 1,
    datasetVersion: 'authored-diagnostic-v1',
    frozenAt: '2026-10-06T00:00:00Z',
    cases: [
      {
        caseId: 'fresh',
        semanticGroupId: 'fresh',
        source: 'authored',
        split: 'tuning',
        language: 'he',
        tags: ['clear'],
        review: {
          author: 'fixture-author',
          reviewer: null,
          reviewedAt: null,
          evidenceReference: null,
        },
        task: 'product_understanding',
        input: {
          rawName: 'חלב טרי',
          metadata: {
            category: 'dairy',
            productType: 'fast_consumable',
            typicalUnit: 'carton',
            isPerishable: null,
          },
          categories: [],
          units: [],
        },
        expected: {
          category: { kind: 'unscored' },
          productType: { kind: 'unscored' },
          typicalUnit: { kind: 'unscored' },
          isPerishable: { kind: 'values', values: [true] },
        },
      },
    ],
  });
  const item = dataset.cases[0];
  if (item.task !== 'product_understanding') throw new Error('Fixture task');
  const request: JevChoiceRequest = {
    task: 'product_understanding',
    taskVersion: definitions[0].adapterVersion,
    questionKey: 'isPerishable',
    state: {
      evidence: {
        rawName: item.input.rawName,
        metadata: { ...item.input.metadata },
      },
    },
    criteria: {
      unknown: 'Insufficient evidence to select an option.',
      perishable: 'perishable',
      nonperishable: 'nonperishable',
    },
    instructions: 'Choose isPerishable using only supplied evidence.',
  };
  const row = {
    caseId: item.caseId,
    inputHash: hash(item.input),
    request,
    orderedChoiceIds: Object.keys(request.criteria),
    orderedRequestHash: orderedRequestHash(request),
    call: {
      provider: 'typesafe' as const,
      requestHash: hash(request),
      elapsedMs: 1,
      transport: {
        status: 'success' as const,
        model: 'jev-1.13.0',
        choice: 'unknown',
        confidence: 1,
        probabilities: { unknown: 1, perishable: 0, nonperishable: 0 },
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    },
    outcome: { status: 'uncertain', reason: 'unknown' },
  };
  const report = {
    ...comparisonBinding(dataset, 'tuning'),
    variants: [
      {
        definition: { ...definitions[0] },
        evidenceMode: 'live' as const,
        complete: true,
        rows: [row],
      },
    ],
  };
  return { dataset, report, row };
}

describe('Perishability diagnostic contract', () => {
  it('keeps authored clear and ambiguous fixtures separate from reviewed accuracy evidence', () => {
    const dataset = parseDataset(
      JSON.parse(
        readFileSync(
          join(
            process.cwd(),
            'evaluation/application-inference/perishability-diagnostic-cases.v1.json',
          ),
          'utf8',
        ),
      ),
    );
    expect(dataset.cases).toHaveLength(12);
    expect(dataset.cases.filter((c) => c.tags.includes('clear'))).toHaveLength(
      6,
    );
    expect(
      dataset.cases.filter((c) => c.tags.includes('ambiguous')),
    ).toHaveLength(6);
    expect(
      dataset.cases.every(
        (c) =>
          c.source === 'authored' &&
          c.split === 'tuning' &&
          c.review.reviewer === null,
      ),
    ).toBe(true);
  });
  it('accepts matched baseline data while keeping tuning evidence inconclusive', () => {
    const { dataset, report } = fixture();
    expect(parsePerishabilityComparison(report, dataset, definitions)).toEqual(
      report,
    );
    expect(report.launchEvidence).toBe('inconclusive');
  });
  it('rejects changed dataset inputs and expected labels', () => {
    const { dataset, report } = fixture();
    dataset.cases[0].input.rawName = 'different';
    expect(() =>
      parsePerishabilityComparison(report, dataset, definitions),
    ).toThrow();
    const other = fixture();
    other.report.labels[0].expected = { kind: 'values', values: [false] };
    expect(() =>
      parsePerishabilityComparison(other.report, other.dataset, definitions),
    ).toThrow();
  });
  it('rejects an unmasked target and a row bound to a different input', () => {
    const { dataset, report, row } = fixture();
    row.inputHash = '0'.repeat(64);
    expect(() =>
      parsePerishabilityComparison(report, dataset, definitions),
    ).toThrow();
    const other = fixture();
    if (other.dataset.cases[0].task !== 'product_understanding')
      throw new Error('Fixture task');
    other.dataset.cases[0].input.metadata.isPerishable = true;
    const rebound = {
      ...comparisonBinding(other.dataset, 'tuning'),
      variants: other.report.variants,
    };
    expect(() =>
      parsePerishabilityComparison(rebound, other.dataset, definitions),
    ).toThrow('hide the target');
  });
  it.each(['adapterVersion', 'questionVersion', 'codeRevision'] as const)(
    'rejects a relabeled %s against its frozen definition',
    (key) => {
      const { dataset, report } = fixture();
      report.variants[0].definition[key] =
        key === 'codeRevision' ? 'b'.repeat(40) : 'changed-v2';
      expect(() =>
        parsePerishabilityComparison(report, dataset, definitions),
      ).toThrow();
    },
  );
  it('detects order changes even when the ordinary request hash is unchanged', () => {
    const { dataset, report, row } = fixture();
    const before = hash(row.request);
    const orderedBefore = row.orderedRequestHash;
    row.request.criteria = Object.fromEntries(
      Object.entries(row.request.criteria).reverse(),
    );
    expect(hash(row.request)).toBe(before);
    expect(orderedRequestHash(row.request)).not.toBe(orderedBefore);
    expect(() =>
      parsePerishabilityComparison(report, dataset, definitions),
    ).toThrow();
  });
  it('rejects altered instructions and distributions and mismatched resolved pins', () => {
    for (const change of [
      (row: ReturnType<typeof fixture>['row']) => {
        row.request.instructions = 'changed';
      },
      (row: ReturnType<typeof fixture>['row']) => {
        row.call.transport.probabilities.unknown = 0.1;
      },
      (row: ReturnType<typeof fixture>['row']) => {
        row.call.transport.model = 'jev-1.12.0';
      },
    ]) {
      const { dataset, report, row } = fixture();
      change(row);
      expect(() =>
        parsePerishabilityComparison(report, dataset, definitions),
      ).toThrow();
    }
  });
  it('rejects missing/duplicate rows, foreign cases and duplicate variants', () => {
    for (const rows of [[], [fixture().row, fixture().row]]) {
      const { dataset, report } = fixture();
      report.variants[0].rows = rows;
      expect(() =>
        parsePerishabilityComparison(report, dataset, definitions),
      ).toThrow();
    }
    const { dataset, report, row } = fixture();
    row.caseId = 'foreign';
    expect(() =>
      parsePerishabilityComparison(report, dataset, definitions),
    ).toThrow();
    report.variants.push(report.variants[0]);
    expect(() =>
      parsePerishabilityComparison(report, dataset, definitions),
    ).toThrow();
  });
  it('keeps incomplete variants explicit and rejects added review/launch claims', () => {
    const { dataset, report } = fixture();
    report.variants[0].complete = false;
    report.variants[0].rows = [];
    expect(parsePerishabilityComparison(report, dataset, definitions)).toEqual(
      report,
    );
    for (const additions of [
      { review: { reviewer: 'invented', reviewedAt: '2026-10-06T00:00:00Z' } },
      { launchEvidence: 'eligible' },
    ])
      expect(() =>
        parsePerishabilityComparison(
          { ...report, ...additions },
          dataset,
          definitions,
        ),
      ).toThrow();
  });
});
