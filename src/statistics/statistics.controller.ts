import {
  Controller,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsResponseDto } from './dto/statistics-response.dto';

@Controller('inventory/statistics')
export class StatisticsController {
  private readonly logger = new Logger(StatisticsController.name);

  constructor(private readonly statisticsService: StatisticsService) {}

  @Post(':productId/calculate')
  @HttpCode(HttpStatus.OK)
  async calculate(
    @Param('productId') productId: string,
  ): Promise<StatisticsResponseDto> {
    try {
      const result =
        await this.statisticsService.calculateProductStatistics(productId);
      return StatisticsResponseDto.fromResult(result);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to calculate statistics for product ${productId}: ${error}`,
      );
      throw new InternalServerErrorException(
        'Failed to calculate product statistics',
      );
    }
  }
}
