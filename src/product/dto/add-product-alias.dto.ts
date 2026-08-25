import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddProductAliasDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  alias: string;
}
