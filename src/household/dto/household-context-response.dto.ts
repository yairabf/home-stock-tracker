import { HouseholdModel } from '../../generated/prisma/models/Household.js';

export class HouseholdContextResponseDto {
  id: string;
  adultsCount: number;
  childrenCount: number;
  childAgeGroups: string[];
  predictionPreferences: Record<string, unknown> | null;
  suggestionConfidenceThreshold: number;
  productPolicies: Record<string, unknown> | null;

  static fromEntity(household: HouseholdModel): HouseholdContextResponseDto {
    const dto = new HouseholdContextResponseDto();
    dto.id = household.id;
    dto.adultsCount = household.adultsCount;
    dto.childrenCount = household.childrenCount;
    dto.childAgeGroups = household.childAgeGroups;
    dto.predictionPreferences = household.predictionPreferences as Record<
      string,
      unknown
    > | null;
    dto.suggestionConfidenceThreshold = household.suggestionConfidenceThreshold;
    dto.productPolicies = household.productPolicies as Record<
      string,
      unknown
    > | null;
    return dto;
  }
}
