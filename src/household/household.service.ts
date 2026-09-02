import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { HouseholdResponseDto } from './dto/household-response.dto';
import { HouseholdContextResponseDto } from './dto/household-context-response.dto';

@Injectable()
export class HouseholdService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(): Promise<HouseholdContextResponseDto> {
    const household = await this.prisma.household.findFirst();

    if (!household) {
      throw new NotFoundException('Household is not configured');
    }

    return HouseholdContextResponseDto.fromEntity(household);
  }

  async getOrCreate(): Promise<HouseholdResponseDto> {
    const existing = await this.prisma.household.findFirst();

    if (existing) {
      return HouseholdResponseDto.fromEntity(existing);
    }

    const household = await this.prisma.household.create({
      data: {},
    });

    return HouseholdResponseDto.fromEntity(household);
  }

  async create(dto: CreateHouseholdDto): Promise<HouseholdResponseDto> {
    const existing = await this.prisma.household.findFirst();

    if (existing) {
      throw new ConflictException('Household already exists');
    }

    const household = await this.prisma.household.create({
      data: {
        adultsCount: dto.adultsCount,
        childrenCount: dto.childrenCount,
        childAgeGroups: dto.childAgeGroups ?? [],
        predictionPreferences: dto.predictionPreferences,
        suggestionConfidenceThreshold: dto.suggestionConfidenceThreshold,
        productPolicies: dto.productPolicies,
      },
    });

    return HouseholdResponseDto.fromEntity(household);
  }

  async update(
    id: string,
    dto: UpdateHouseholdDto,
  ): Promise<HouseholdResponseDto> {
    const existing = await this.prisma.household.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Household ${id} not found`);
    }

    const household = await this.prisma.household.update({
      where: { id },
      data: {
        adultsCount: dto.adultsCount,
        childrenCount: dto.childrenCount,
        childAgeGroups: dto.childAgeGroups,
        predictionPreferences: dto.predictionPreferences,
        suggestionConfidenceThreshold: dto.suggestionConfidenceThreshold,
        productPolicies: dto.productPolicies,
      },
    });

    return HouseholdResponseDto.fromEntity(household);
  }
}
