import { IsDefined, IsNumber, IsPositive } from 'class-validator';

export class SetGroceryItemQuantityDto {
  @IsDefined()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  requestedQuantity: number;

  @IsDefined()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  expectedRequestedQuantity: number;
}
