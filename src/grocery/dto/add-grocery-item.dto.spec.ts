import { validate } from 'class-validator';
import { AddGroceryItemDto } from './add-grocery-item.dto';

describe('AddGroceryItemDto', () => {
  it.each([
    ['an omitted quantity', undefined],
    ['a positive fraction', 0.5],
  ])('accepts %s', async (_, requestedQuantity) => {
    await expect(validateDto(requestedQuantity)).resolves.toHaveLength(0);
  });

  it.each([
    ['zero', 0],
    ['a negative value', -1],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ])('rejects %s', async (_, requestedQuantity) => {
    const errors = await validateDto(requestedQuantity);

    expect(errors).toEqual([
      expect.objectContaining({ property: 'requestedQuantity' }),
    ]);
  });

  function validateDto(requestedQuantity: number | undefined) {
    const dto = new AddGroceryItemDto();
    dto.productName = 'milk';
    dto.requestedQuantity = requestedQuantity;
    return validate(dto);
  }
});
