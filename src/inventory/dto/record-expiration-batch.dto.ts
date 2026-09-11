import { IsISO8601, IsNotEmpty, IsString, Matches } from 'class-validator';

const EXPLICIT_TIMEZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;

export class RecordExpirationBatchDto {
  @IsString()
  @IsNotEmpty()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPLICIT_TIMEZONE, {
    message: 'expiresAt must include an explicit timezone',
  })
  expiresAt: string;
}
