import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReadinessResponseDto } from './dto/readiness-response.dto';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkReadiness(): Promise<ReadinessResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', checks: { database: 'up' } };
    } catch {
      return { status: 'error', checks: { database: 'down' } };
    }
  }
}
