import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { HealthResponseDto } from './dto/health-response.dto';
import { ReadinessResponseDto } from './dto/readiness-response.dto';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('health')
  getHealth(): HealthResponseDto {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async getReadiness(): Promise<ReadinessResponseDto> {
    const readiness = await this.healthService.checkReadiness();
    if (readiness.status === 'error') {
      throw new HttpException(readiness, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return readiness;
  }
}
