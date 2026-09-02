import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdService } from './household.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('HouseholdService', () => {
  let service: HouseholdService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseholdService,
        {
          provide: PrismaService,
          useValue: {
            household: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<HouseholdService>(HouseholdService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getContext', () => {
    it('returns only the configured prediction context without writing', async () => {
      const household = {
        id: 'configured-household-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: ['child', 'teen'],
        predictionPreferences: { preferRecentSignals: true },
        suggestionConfidenceThreshold: 0.8,
        productPolicies: { milk: { predictionEnabled: true } },
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-09-01T10:00:00.000Z'),
      };
      prisma.household.findFirst.mockResolvedValue(household);

      await expect(service.getContext()).resolves.toEqual({
        id: 'configured-household-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: ['child', 'teen'],
        predictionPreferences: { preferRecentSignals: true },
        suggestionConfidenceThreshold: 0.8,
        productPolicies: { milk: { predictionEnabled: true } },
      });
      expect(prisma.household.create).not.toHaveBeenCalled();
      expect(prisma.household.update).not.toHaveBeenCalled();
    });

    it('fails without creating defaults when no household is configured', async () => {
      prisma.household.findFirst.mockResolvedValue(null);

      await expect(service.getContext()).rejects.toThrow(
        new NotFoundException('Household is not configured'),
      );
      expect(prisma.household.create).not.toHaveBeenCalled();
      expect(prisma.household.update).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreate', () => {
    it('should return existing household if one exists', async () => {
      const mockHousehold = {
        id: 'test-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        predictionPreferences: null,
        suggestionConfidenceThreshold: 0.7,
        productPolicies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.household.findFirst.mockResolvedValue(mockHousehold);

      const result = await service.getOrCreate();

      expect(result.id).toBe('test-id');
      expect(prisma.household.findFirst).toHaveBeenCalled();
      expect(prisma.household.create).not.toHaveBeenCalled();
    });

    it('should create default household if none exists', async () => {
      const mockHousehold = {
        id: 'new-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        predictionPreferences: null,
        suggestionConfidenceThreshold: 0.7,
        productPolicies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.household.findFirst.mockResolvedValue(null);
      prisma.household.create.mockResolvedValue(mockHousehold);

      const result = await service.getOrCreate();

      expect(result.id).toBe('new-id');
      expect(prisma.household.findFirst).toHaveBeenCalled();
      expect(prisma.household.create).toHaveBeenCalledWith({ data: {} });
    });
  });

  describe('create', () => {
    it('should create a new household when none exists', async () => {
      const dto = {
        adultsCount: 4,
        childrenCount: 2,
        childAgeGroups: ['teen', 'child'],
        predictionPreferences: { testKey: 'testValue' },
        suggestionConfidenceThreshold: 0.8,
        productPolicies: null,
      };

      const mockHousehold = {
        id: 'new-id',
        ...dto,
        childAgeGroups: dto.childAgeGroups,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.household.findFirst.mockResolvedValue(null);
      prisma.household.create.mockResolvedValue(mockHousehold);

      const result = await service.create(dto);

      expect(result.adultsCount).toBe(4);
      expect(result.childrenCount).toBe(2);
      expect(result.childAgeGroups).toEqual(['teen', 'child']);
    });

    it('should reject duplicate household creation', async () => {
      const existingHousehold = {
        id: 'existing-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        predictionPreferences: null,
        suggestionConfidenceThreshold: 0.7,
        productPolicies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.household.findFirst.mockResolvedValue(existingHousehold);

      await expect(service.create({})).rejects.toThrow(ConflictException);
      expect(prisma.household.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update existing household', async () => {
      const id = 'test-id';
      const dto = {
        adultsCount: 5,
        childrenCount: 1,
      };

      const existingHousehold = {
        id,
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        predictionPreferences: null,
        suggestionConfidenceThreshold: 0.7,
        productPolicies: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedHousehold = {
        ...existingHousehold,
        ...dto,
      };

      prisma.household.findUnique.mockResolvedValue(existingHousehold);
      prisma.household.update.mockResolvedValue(updatedHousehold);

      const result = await service.update(id, dto);

      expect(result.adultsCount).toBe(5);
      expect(result.childrenCount).toBe(1);
    });

    it('should reject update for non-existent household', async () => {
      const id = 'non-existent';
      const dto = { adultsCount: 5 };

      prisma.household.findUnique.mockResolvedValue(null);

      await expect(service.update(id, dto)).rejects.toThrow(NotFoundException);
      expect(prisma.household.update).not.toHaveBeenCalled();
    });
  });
});
