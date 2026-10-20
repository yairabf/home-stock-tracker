import { AssistedBatchPreparation } from './assisted-batch-preparation.service';
import { duplicateProductIssues } from './assisted-batch-issues';
import type {
  CatalogPreparationResult,
  PreparedCatalogProduct,
} from './assisted-preparation';
import type { AssistedActionRequest } from './assisted-action-request';

const item = (productName: string) => ({
  productName,
  ifPendingExists: 'return_existing' as const,
});
const product = (name: string): PreparedCatalogProduct => ({
  canonicalName: name,
  suppliedName: name,
  aliasToAdd: null,
  existing: null,
  metadata: {
    category: null,
    typicalUnit: null,
    productType: null,
    isPerishable: null,
  },
  understanding: null,
  identityEvidence: null,
});
describe('AssistedBatchPreparation', () => {
  const prepare = jest.fn<
    Promise<CatalogPreparationResult>,
    [AssistedActionRequest['items'][number], number]
  >();
  const batch = new AssistedBatchPreparation({ prepare } as never);
  beforeEach(() => prepare.mockReset());

  it('rejects repeated input identities before inference, including all indices', async () => {
    expect(
      await batch.prepare([item('Milk'), item(' bread '), item(' milk ')]),
    ).toEqual({
      outcome: 'needs_input',
      issues: [
        { inputIndex: 0, code: 'duplicate_product' },
        { inputIndex: 2, code: 'duplicate_product' },
      ],
    });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('bounds concurrency to four and preserves input order', async () => {
    let active = 0;
    let maximum = 0;
    const releases: Array<() => void> = [];
    prepare.mockImplementation(async (input) => {
      maximum = Math.max(maximum, ++active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return { outcome: 'prepared', product: product(input.productName!) };
    });
    const pending = batch.prepare(
      Array.from({ length: 7 }, (_, i) => item(`item-${i}`)),
    );
    expect(prepare).toHaveBeenCalledTimes(4);
    releases
      .splice(0)
      .reverse()
      .forEach((release) => release());
    await new Promise<void>((resolve) => setImmediate(resolve));
    releases.splice(0).forEach((release) => release());
    const result = await pending;
    expect(maximum).toBe(4);
    expect(prepare).toHaveBeenCalledTimes(7);
    expect(
      new Set(prepare.mock.calls.map(([, deadline]) => deadline)).size,
    ).toBe(1);
    expect(result.outcome).toBe('prepared');
    if (result.outcome === 'prepared')
      expect(result.products.map((p) => p.canonicalName)).toEqual(
        Array.from({ length: 7 }, (_, i) => `item-${i}`),
      );
  });

  it('rejects different phrases that resolve to one canonical product', async () => {
    prepare.mockResolvedValue({
      outcome: 'prepared',
      product: product('milk'),
    });
    expect(
      await batch.prepare([item('Nestle milk'), item('other milk')]),
    ).toMatchObject({
      outcome: 'needs_input',
      issues: [{ inputIndex: 0 }, { inputIndex: 1 }],
    });
  });

  it('collects indexed ambiguity without returning partial prepared success', async () => {
    prepare
      .mockResolvedValueOnce({ outcome: 'prepared', product: product('milk') })
      .mockResolvedValueOnce({
        outcome: 'needs_input',
        code: 'ambiguous_product',
      })
      .mockResolvedValueOnce({
        outcome: 'needs_input',
        code: 'metadata_conflict',
      });
    expect(await batch.prepare([item('a'), item('b'), item('c')])).toEqual({
      outcome: 'needs_input',
      issues: [
        { inputIndex: 1, code: 'ambiguous_product' },
        { inputIndex: 2, code: 'metadata_conflict' },
      ],
    });
  });

  it('returns provider unavailability instead of partial success', async () => {
    prepare
      .mockResolvedValueOnce({ outcome: 'prepared', product: product('milk') })
      .mockResolvedValueOnce({
        outcome: 'unavailable',
        code: 'provider_deadline',
        retryable: true,
      });
    expect(await batch.prepare([item('a'), item('b')])).toEqual({
      outcome: 'unavailable',
      code: 'provider_deadline',
      retryable: true,
    });
  });

  it('marks every overlapping product identity exactly once', () => {
    expect(
      duplicateProductIssues([
        ['id:1', 'name:milk'],
        ['id:1', 'name:milk'],
        ['id:2'],
        ['name:milk'],
      ]),
    ).toEqual(
      [0, 1, 3].map((inputIndex) => ({
        inputIndex,
        code: 'duplicate_product',
      })),
    );
  });
});
