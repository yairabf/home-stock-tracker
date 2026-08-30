import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';

export class CompletePartialPurchaseDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  // Inclusive mode: complete these items only
  @ValidateIf((o: CompletePartialPurchaseDto) => !o.omitItemIds)
  @IsArray()
  @ArrayMinSize(1, { message: 'completeItemIds cannot be empty' })
  @IsUUID('4', { each: true })
  completeItemIds?: string[];

  // Exclusive mode: complete all pending except these
  @ValidateIf((o: CompletePartialPurchaseDto) => !o.completeItemIds)
  @IsArray()
  @ArrayMinSize(1, { message: 'omitItemIds cannot be empty' })
  @IsUUID('4', { each: true })
  omitItemIds?: string[];

  // XOR validation: exactly one of completeItemIds or omitItemIds must be provided
  @ValidateIf((o: CompletePartialPurchaseDto): boolean =>
    Boolean(
      (!o.completeItemIds && !o.omitItemIds) ||
      (o.completeItemIds && o.omitItemIds),
    ),
  )
  @IsNotEmpty({
    message:
      'Exactly one of completeItemIds or omitItemIds must be provided, but not both',
  })
  _xorValidation?: never;
}
