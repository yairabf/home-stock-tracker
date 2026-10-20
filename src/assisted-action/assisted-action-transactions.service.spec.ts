import { AssistedActionTransactions } from './assisted-action-transactions.service';
import { AssistedBatchIssues } from './assisted-batch-issues';
import { Prisma } from '../generated/prisma/client';
import { parseAssistedActionRequest } from './assisted-action-request';
import { assistedActionRequestHash } from './assisted-action-replay';

const request = parseAssistedActionRequest({
  requestId: '7ac2eb19-ddae-44b3-ad45-324ae4dba321',
  operation: 'grocery_add',
  items: [{ productName: 'milk' }],
});
const hash = assistedActionRequestHash(request);
describe('AssistedActionTransactions', () => {
  const findUnique = jest.fn();
  const transaction = jest.fn();
  const service = new AssistedActionTransactions({
    assistedActionReceipt: { findUnique },
    $transaction: transaction,
  } as never);
  beforeEach(() => {
    jest.resetAllMocks();
    findUnique.mockResolvedValue(null);
  });

  it('bounds transaction retries and reports exhaustion', async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('race', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    const work = jest.fn();
    expect(await service.execute(request, hash, work)).toEqual({
      outcome: 'unavailable',
      requestId: request.requestId,
      retryable: true,
      code: 'concurrency_exhausted',
    });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('returns indexed catalog issues after the owning transaction rolls back', async () => {
    transaction.mockRejectedValue(
      new AssistedBatchIssues([{ inputIndex: 0, code: 'alias_conflict' }]),
    );
    expect(await service.execute(request, hash, jest.fn())).toEqual({
      outcome: 'needs_input',
      requestId: request.requestId,
      issues: [{ inputIndex: 0, code: 'alias_conflict' }],
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not hide unexpected persistence failures', async () => {
    transaction.mockRejectedValue(new Error('storage failure'));
    await expect(service.execute(request, hash, jest.fn())).rejects.toThrow(
      'storage failure',
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects changed payload before returning a saved result', async () => {
    findUnique.mockResolvedValue({ requestHash: 'different' });
    await expect(service.findReplay(request, hash)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('rejects malformed stored receipts', async () => {
    findUnique.mockResolvedValue({
      requestHash: hash,
      response: { outcome: 'applied' },
    });
    await expect(service.findReplay(request, hash)).rejects.toThrow();
  });
});
