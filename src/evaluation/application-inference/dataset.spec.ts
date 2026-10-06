import { parseDataset, generationTransportSchema } from './dataset';
import { binding, parseRecording } from './recording';
import { safetyDataset } from './fixture';

describe('Application evaluation contracts', () => {
  it('loads explicitly authored safety cases with no fabricated reviews', () => {
    const d = safetyDataset();
    expect(d.cases.length).toBe(20);
    expect(
      d.cases.every(
        (c) => c.source === 'authored' && c.review.reviewer === null,
      ),
    ).toBe(true);
    expect(new Set(d.cases.map((c) => c.language))).toEqual(
      new Set(['he', 'en', 'mixed']),
    );
  });
  it('rejects duplicate IDs, split leakage, excessive input and invalid labels', () => {
    const d = safetyDataset();
    expect(() =>
      parseDataset({ ...d, cases: [d.cases[0], d.cases[0]] }),
    ).toThrow();
    expect(() =>
      parseDataset({
        ...d,
        cases: [
          d.cases[0],
          { ...d.cases[0], caseId: 'different', split: 'tuning' },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseDataset({ ...d, cases: Array(201).fill(d.cases[0]) }),
    ).toThrow();
    expect(() =>
      parseDataset({
        ...d,
        cases: [
          {
            ...d.cases[0],
            input: { ...d.cases[0].input, rawName: 'a'.repeat(17000) },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      parseDataset({
        ...d,
        cases: [
          {
            ...d.cases[0],
            expected: { category: { kind: 'values', values: [false] } },
          },
        ],
      }),
    ).toThrow();
  });
  it('rejects self review, review after freeze, and extra fields', () => {
    const d = safetyDataset();
    for (const reviewer of ['fixture-author', 'independent']) {
      expect(() =>
        parseDataset({
          ...d,
          cases: [
            {
              ...d.cases[0],
              review: {
                author: 'fixture-author',
                reviewer,
                reviewedAt: '2026-10-07T00:00:00Z',
                evidenceReference: 'private-reference',
              },
            },
          ],
        }),
      ).toThrow();
    }
    expect(() => parseDataset({ ...d, secret: 'forbidden' })).toThrow();
  });
  it('binds recordings to dataset, input, task, version and split', () => {
    const d = safetyDataset();
    const r = {
      ...binding(d, 'product_understanding', 'held_out', 'jev-1.13.0'),
      rows: [],
    };
    expect(parseRecording(r, d, 'product_understanding', 'held_out')).toEqual(
      r,
    );
    expect(() =>
      parseRecording(
        { ...r, inputHash: '0'.repeat(64) },
        d,
        'product_understanding',
        'held_out',
      ),
    ).toThrow();
    expect(() =>
      parseRecording(
        { ...r, rows: [{ caseId: 'absent', calls: [] }] },
        d,
        'product_understanding',
        'held_out',
      ),
    ).toThrow();
    expect(() =>
      generationTransportSchema.parse({
        status: 'success',
        provider: 'openai',
        model: 'configured',
        value: {
          kind: 'finite',
          shelfLifeDays: null,
          confidence: 1,
          rationale: 'bad',
        },
      }),
    ).toThrow();
  });
});
