import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InventoryEventType } from '../../generated/prisma/enums';
import { MAX_BATCH_PURCHASE_ITEMS } from '../types/purchase-contract';
import { RecordPurchasesDto } from './record-purchases.dto';

const productId = 'e67dbb4f-276c-4f31-9695-d906a6798b0b';
const secondProductId = '71c5ce21-cf65-4cf1-a795-7d6a1be2db65';

describe('RecordPurchasesDto', () => {
  it('accepts and normalizes the legacy single-purchase shape', async () => {
    const dto = request({
      productId,
      eventType: InventoryEventType.PURCHASED,
      quantity: 2,
      unit: ' carton ',
      purchasedAt: '2026-09-03T08:00:00+03:00',
    });

    await expect(validateDto(dto)).resolves.toHaveLength(0);
    expect(dto.unit).toBe('carton');
  });

  it('accepts a duplicate-free batch and trims nested units', async () => {
    const dto = request({
      purchasedAt: '2026-09-03T05:00:00Z',
      items: [
        { productId, unit: ' liter ' },
        { productId: secondProductId, quantity: 2 },
      ],
    });

    await expect(validateDto(dto)).resolves.toHaveLength(0);
    expect(dto.items?.[0].unit).toBe('liter');
  });

  it.each([
    ['empty request', {}],
    ['incomplete single request', { productId }],
    [
      'mixed request shapes',
      {
        productId,
        eventType: InventoryEventType.PURCHASED,
        items: [{ productId: secondProductId }],
      },
    ],
    ['empty batch', { items: [] }],
    ['duplicate products', { items: [{ productId }, { productId }] }],
    ['blank nested unit', { items: [{ productId, unit: '  ' }] }],
    ['zero quantity', { items: [{ productId, quantity: 0 }] }],
    [
      'timezone-free timestamp',
      { items: [{ productId, purchasedAt: '2026-09-03T05:00:00' }] },
    ],
    [
      'date-only timestamp',
      { items: [{ productId, purchasedAt: '2026-09-03' }] },
    ],
  ])('rejects %s', async (_label, input) => {
    expect(await validateDto(request(input))).not.toHaveLength(0);
  });

  it('rejects batches above the size limit', async () => {
    const items = Array.from(
      { length: MAX_BATCH_PURCHASE_ITEMS + 1 },
      (_, index) => ({
        productId: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
      }),
    );
    expect(await validateDto(request({ items }))).not.toHaveLength(0);
  });

  it('rejects unknown nested fields under whitelist validation', async () => {
    const dto = request({ items: [{ productId, source: 'mcp' }] });
    expect(await validateDto(dto)).not.toHaveLength(0);
  });
});

function request(input: object): RecordPurchasesDto {
  return plainToInstance(RecordPurchasesDto, input);
}

function validateDto(dto: RecordPurchasesDto) {
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}
