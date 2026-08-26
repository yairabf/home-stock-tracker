import { HouseholdModel } from '../../generated/prisma/models/Household.js';

export class HouseholdResponseDto {
  id: string;
  adultsCount: number;
  childrenCount: number;
  childAgeGroups: string[];
  predictionPreferences: Record<string, any> | null;
  suggestionConfidenceThreshold: number;
  productPolicies: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(household: HouseholdModel): HouseholdResponseDto {
    const dto = new HouseholdResponseDto();
    dto.id = household.id;
    dto.adultsCount = household.adultsCount;
    dto.childrenCount = household.childrenCount;
    dto.childAgeGroups = household.childAgeGroups;
    dto.predictionPreferences = household.predictionPreferences as Record<string, any> | null;
    dto.suggestionConfidenceThreshold = household.suggestionConfidenceThreshold;
    dto.productPolicies = household.productPolicies as Record<string, any> | null;
    dto.createdAt = household.createdAt;
    dto.updatedAt = household.updatedAt;
    return dto;
  }
}
