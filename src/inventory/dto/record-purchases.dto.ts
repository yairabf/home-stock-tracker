import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { InventoryEventType } from '../../generated/prisma/enums';
import { MAX_BATCH_PURCHASE_ITEMS } from '../types/purchase-contract';

const PURCHASE_EVENT_TYPES = [
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
] as const;
const EXPLICIT_TIMEZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;

export class RecordPurchaseBatchItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_TIMEZONE, {
    message: 'purchasedAt must include an explicit timezone',
  })
  purchasedAt?: string;
}

@ValidatorConstraint({ name: 'recordPurchasesShape' })
class RecordPurchasesShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as RecordPurchasesDto;
    if (request.items !== undefined) {
      return [
        request.productId,
        request.eventType,
        request.quantity,
        request.unit,
        request.confidence,
        request.metadata,
      ].every((value) => value === undefined);
    }
    return request.productId !== undefined && request.eventType !== undefined;
  }

  defaultMessage(): string {
    return 'Provide exactly one single-purchase or batch-purchase shape';
  }
}

export class RecordPurchasesDto {
  @ValidateIf((request: RecordPurchasesDto) => request.items === undefined)
  @IsUUID()
  productId?: string;

  @ValidateIf((request: RecordPurchasesDto) => request.items === undefined)
  @IsIn(PURCHASE_EVENT_TYPES)
  eventType?: (typeof PURCHASE_EVENT_TYPES)[number];

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_TIMEZONE, {
    message: 'purchasedAt must include an explicit timezone',
  })
  purchasedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_PURCHASE_ITEMS)
  @ArrayUnique((item: RecordPurchaseBatchItemDto) => item?.productId)
  @ValidateNested({ each: true })
  @Type(() => RecordPurchaseBatchItemDto)
  items?: RecordPurchaseBatchItemDto[];

  @Validate(RecordPurchasesShapeConstraint)
  private readonly _shape?: never;
}
