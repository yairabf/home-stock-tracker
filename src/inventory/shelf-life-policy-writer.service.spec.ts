import { Prisma } from '../generated/prisma/client';
import {
  ShelfLifePolicyWriter,
  type PolicyWriteOutcome,
  policyInput,
} from './shelf-life-policy-writer.service';
import type { ShelfLifePolicyResult } from './shelf-life-policy';

const product = {
  id: 'product',
  names: [{ displayName: 'eggs' }],
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: true,
  config: null,
};
const input = policyInput(product)!;
const result: ShelfLifePolicyResult = {
  status: 'resolved',
  value: {
    kind: 'finite',
    shelfLifeDays: 21,
    confidence: 0.95,
    rationale: 'Reviewed policy',
  },
  provider: 'typesafe',
  model: 'jev-1.0.0',
  taskVersion: 'jev-shelf-life-policy-v1',
  attempts: [],
};

describe('ShelfLifePolicyWriter', () => {
  const create = jest.fn(),
    findUnique = jest.fn(),
    findPolicy = jest.fn(),
    query = jest.fn(),
    transaction = jest.fn(),
    outsidePolicy = jest.fn();
  const tx = {
    product: { findUnique },
    productShelfLifePolicy: { findUnique: findPolicy, create },
    $queryRaw: query,
  };
  const writer = new ShelfLifePolicyWriter({
    $transaction: transaction,
    productShelfLifePolicy: { findUnique: outsidePolicy },
  } as never);
  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation(
      (operation: (value: typeof tx) => Promise<PolicyWriteOutcome>) =>
        operation(tx),
    );
    findUnique.mockResolvedValue(product);
    findPolicy.mockResolvedValue(null);
    outsidePolicy.mockResolvedValue(null);
    create.mockResolvedValue({});
    query.mockResolvedValue([]);
  });
  it('locks evidence and creates only with the supplying task provenance', async () => {
    const at = new Date();
    expect(await writer.write(input, result, at)).toBe('applied');
    expect(query).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        productId: 'product',
        ...result.value,
        modelProvider: 'typesafe',
        modelVersion: 'jev-1.0.0',
        promptVersion: result.taskVersion,
        evaluatedAt: at,
      },
    });
  });
  it.each([
    { ...product, category: 'changed' },
    { ...product, names: [{ displayName: 'renamed' }] },
    null,
    {
      ...product,
      config: {
        shelfLifeContext: {
          version: 1,
          storage: 'ambient',
          maxTemperatureC: null,
          preparation: 'unknown',
          form: 'unknown',
        },
      },
    },
  ])('skips changed/deleted evidence', async (current) => {
    findUnique.mockResolvedValue(current);
    expect(await writer.write(input, result, new Date())).toBe('stale');
    expect(create).not.toHaveBeenCalled();
  });
  it('reuses an existing policy without overwriting it', async () => {
    findPolicy.mockResolvedValue({ id: 'existing' });
    expect(await writer.write(input, result, new Date())).toBe('reused');
    expect(create).not.toHaveBeenCalled();
  });
  it.each(['P2002', 'P2034'])(
    'recovers a concurrent insertion outside the aborted transaction (%s)',
    async (code) => {
      transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code,
          clientVersion: 'test',
        }),
      );
      outsidePolicy.mockResolvedValue({ id: 'existing' });
      expect(await writer.write(input, result, new Date())).toBe('reused');
    },
  );
  it('rechecks evidence on serialization retry without another model call', async () => {
    transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    findUnique.mockResolvedValue({ ...product, isPerishable: false });
    expect(await writer.write(input, result, new Date())).toBe('stale');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects malformed accepted policies before opening a transaction', async () => {
    expect(
      await writer.write(
        input,
        { ...result, value: { ...result.value, shelfLifeDays: 0 } },
        new Date(),
      ),
    ).toBe('unresolved');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('does not reinterpret unrelated configuration changes as shelf-life facts', async () => {
    findUnique.mockResolvedValue({ ...product, config: { unrelated: 123 } });
    expect(await writer.write(input, result, new Date())).toBe('applied');
  });
});
