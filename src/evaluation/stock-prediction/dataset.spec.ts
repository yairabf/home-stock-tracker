import { hash, groundTruth, inputEvents, parseDataset } from './dataset';
import { stockDataset } from './fixture';

describe('stock evaluation dataset', () => {
  it('hashes object fields canonically while retaining meaningful array order', () => {
    expect(hash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      hash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(hash([1, 2])).not.toBe(hash([2, 1]));
  });
  it('censors conflicting confirmations at the same instant across UTC offsets', () => {
    const c = stockDataset().cases[0];
    c.confirmations = [
      {
        evidenceReference: 'one',
        confirmedAt: '2026-01-10T12:00:00Z',
        state: 'low',
        sourceType: 'STOCK_LOW',
      },
      {
        evidenceReference: 'two',
        confirmedAt: '2026-01-10T14:00:00+02:00',
        state: 'out',
        sourceType: 'STOCK_OUT',
      },
    ];
    expect(groundTruth(c).reason).toBe('conflicting_confirmation');
  });
  it('accepts authored pending evidence without inventing review', () => {
    expect(parseDataset(stockDataset()).cases[0].review.status).toBe('pending');
  });
  it.each(['asOf', 'product', 'review', 'events'])(
    'rejects malformed %s',
    (key) => {
      const d = stockDataset();
      (d.cases[0] as unknown as Record<string, unknown>)[key] = 'bad';
      expect(() => parseDataset(d)).toThrow('Invalid stock evaluation dataset');
    },
  );
  it('rejects duplicate episodes, foreign fields, future snapshots and cross-split groups', () => {
    const d = stockDataset();
    d.cases.push({ ...d.cases[0], id: 'another' });
    expect(() => parseDataset(d)).toThrow();
    d.cases[1].episodeId = 'another';
    d.cases[1].split = 'tuning';
    expect(() => parseDataset(d)).toThrow();
    d.cases.pop();
    d.cases[0].product.knownAt = '2027-01-01T00:00:00Z';
    expect(() => parseDataset(d)).toThrow();
    expect(() =>
      parseDataset({ ...stockDataset(), secret: 'unexpected' }),
    ).toThrow();
  });
  it('requires a distinct reviewer and historical attestation', () => {
    const d = stockDataset();
    const r = d.cases[0].review;
    r.status = 'reviewed';
    r.reviewer = r.author;
    r.reviewedAt = '2026-02-01T00:00:00Z';
    expect(() => parseDataset(d)).toThrow();
    r.reviewer = 'reviewer';
    d.cases[0].source = 'historical';
    expect(() => parseDataset(d)).toThrow();
    r.evidenceReference = 'episode-source';
    r.episodeComplete = true;
    expect(parseDataset(d).cases[0].source).toBe('historical');
  });
  it('excludes later-known and future events', () => {
    const c = stockDataset().cases[0];
    c.events = [
      {
        id: 'backdated',
        eventType: 'PURCHASED',
        occurredAt: '2026-01-01T00:00:00Z',
        knownAt: '2026-01-11T00:00:00Z',
        quantity: 1,
        unit: null,
      },
    ];
    expect(inputEvents(c)).toEqual([]);
  });
  it('censors late, conflicting and mutated outcomes, never guesses missing labels', () => {
    const c = stockDataset().cases[0];
    expect(groundTruth(c).reason).toBe('missing_confirmation');
    c.confirmations = [
      {
        evidenceReference: 'confirmation',
        confirmedAt: '2026-01-11T00:00:00Z',
        state: 'low',
        sourceType: 'STOCK_LOW',
      },
    ];
    expect(groundTruth(c).state).toBe('low');
    c.confirmations[0].confirmedAt = '2026-01-11T00:00:01Z';
    expect(groundTruth(c).reason).toBe('late_confirmation');
    c.confirmations[0].confirmedAt = '2026-01-10T12:00:00Z';
    c.confirmations.push({
      ...c.confirmations[0],
      evidenceReference: 'conflict',
      state: 'out',
      sourceType: 'STOCK_OUT',
    });
    expect(groundTruth(c).reason).toBe('conflicting_confirmation');
    c.confirmations.pop();
    c.events.push({
      id: 'mutation',
      eventType: 'STOCK_CONSUMED',
      occurredAt: '2026-01-10T01:00:00Z',
      knownAt: '2026-01-10T01:00:00Z',
      quantity: 1,
      unit: null,
    });
    expect(groundTruth(c).reason).toBe('intervening_mutation');
  });
});
