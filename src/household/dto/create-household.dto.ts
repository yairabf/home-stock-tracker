import { IsInt, IsOptional, IsArray, IsNumber, Min, Max, IsString } from 'class-validator';

export class CreateHouseholdDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  adultsCount?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  childrenCount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  childAgeGroups?: string[];

  @IsOptional()
  predictionPreferences?: Record<string, any>;

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  @IsOptional()
  suggestionConfidenceThreshold?: number;

  @IsOptional()
  productPolicies?: Record<string, any>;
}
