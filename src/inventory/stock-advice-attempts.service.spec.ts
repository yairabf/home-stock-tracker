import { Prisma } from '../generated/prisma/client';
import { StockAdviceAttempts } from './stock-advice-attempts.service';

describe('StockAdviceAttempts', () => {
  const create = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const service = new StockAdviceAttempts({
    stockAdviceAttempt: { create, findUniqueOrThrow },
  } as never);
  const input = {
    productId: 'p',
    fingerprint: 'f',
    taskVersion: 'v',
    configuredModel: 'jev-1.13.0',
  };
  beforeEach(() => jest.resetAllMocks());
  it('owns only a successfully inserted reservation', async () => {
    create.mockResolvedValue({ id: 'a' });
    await expect(service.reserve(input)).resolves.toEqual({
      owned: true,
      attempt: { id: 'a' },
    });
  });
  it('reuses the database winner after a unique constraint race', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );
    findUniqueOrThrow.mockResolvedValue({ id: 'winner', status: 'reserved' });
    await expect(service.reserve(input)).resolves.toMatchObject({
      owned: false,
      attempt: { id: 'winner' },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { productId_fingerprint: { productId: 'p', fingerprint: 'f' } },
    });
  });
  it('fails closed for database outages', async () => {
    create.mockRejectedValue(new Error('database'));
    await expect(service.reserve(input)).rejects.toThrow('database');
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
