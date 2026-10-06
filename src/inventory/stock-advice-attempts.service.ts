import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface StockAdviceReservation {
  productId: string;
  fingerprint: string;
  taskVersion: string;
  configuredModel: string;
}

@Injectable()
export class StockAdviceAttempts {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: StockAdviceReservation) {
    try {
      const attempt = await this.prisma.stockAdviceAttempt.create({
        data: input,
      });
      return { owned: true, attempt };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const attempt = await this.prisma.stockAdviceAttempt.findUniqueOrThrow({
        where: {
          productId_fingerprint: {
            productId: input.productId,
            fingerprint: input.fingerprint,
          },
        },
      });
      return { owned: false, attempt };
    }
  }
}
