import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StockMutationOperation } from '../types/stock-mutation';
import { UpdateStockDto } from './update-stock.dto';

describe('UpdateStockDto', () => {
  it.each([
    { operation: StockMutationOperation.set, quantity: 2, unit: ' liter ' },
    { operation: StockMutationOperation.decrement, quantity: 0.5 },
    { operation: StockMutationOperation.mark_out },
  ])('accepts an operation-specific request', async (input) => {
    const dto = plainToInstance(UpdateStockDto, input);

    await expect(validateDto(dto)).resolves.toHaveLength(0);
    if (input.unit) {
      expect(dto.unit).toBe('liter');
    }
  });

  it.each([
    { operation: StockMutationOperation.set },
    { operation: StockMutationOperation.decrement },
    { operation: StockMutationOperation.mark_out, quantity: 1 },
    { operation: StockMutationOperation.mark_out, unit: 'item' },
    { operation: 'replace', quantity: 1 },
    { operation: StockMutationOperation.set, quantity: 0 },
    { operation: StockMutationOperation.set, quantity: Number.NaN },
    {
      operation: StockMutationOperation.set,
      quantity: Number.POSITIVE_INFINITY,
    },
    { operation: StockMutationOperation.set, quantity: 1, unit: '  ' },
  ])('rejects an invalid mutation shape %#', async (input) => {
    const dto = plainToInstance(UpdateStockDto, input);
    expect(await validateDto(dto)).not.toHaveLength(0);
  });

  it('rejects unknown fields under whitelist validation', async () => {
    const dto = plainToInstance(UpdateStockDto, {
      operation: StockMutationOperation.set,
      quantity: 1,
      source: 'api',
    });
    expect(await validateDto(dto)).not.toHaveLength(0);
  });
});

function validateDto(dto: UpdateStockDto) {
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}
