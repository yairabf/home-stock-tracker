import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HouseholdService } from './household.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { HouseholdResponseDto } from './dto/household-response.dto';

@Controller('household')
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get()
  async getOrCreate(): Promise<HouseholdResponseDto> {
    return this.householdService.getOrCreate();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateHouseholdDto): Promise<HouseholdResponseDto> {
    return this.householdService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHouseholdDto,
  ): Promise<HouseholdResponseDto> {
    return this.householdService.update(id, dto);
  }
}
