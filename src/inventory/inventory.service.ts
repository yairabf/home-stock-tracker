import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { ListInventoryEventsDto } from './dto/list-inventory-events.dto';
import { InventoryEventResponseDto } from './dto/inventory-event-response.dto';
import { InventoryEventListResponseDto } from './dto/inventory-event-list-response.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async recordEvent(
    dto: RecordInventoryEventDto,
  ): Promise<InventoryEventResponseDto> {
    await this.productService.findOne(dto.productId);

    const event = await this.prisma.inventoryEvent.create({
      data: {
        productId: dto.productId,
        eventType: dto.eventType,
        quantity: dto.quantity,
        unit: dto.unit,
        source: dto.source,
        confidence: dto.confidence,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return InventoryEventResponseDto.fromEntity(event);
  }

  async listEvents(
    query: ListInventoryEventsDto,
  ): Promise<InventoryEventListResponseDto> {
    const where = {
      ...(query.productId && { productId: query.productId }),
      ...(query.eventType && { eventType: query.eventType }),
    };
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [events, total] = await Promise.all([
      this.prisma.inventoryEvent.findMany({
        where,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.inventoryEvent.count({ where }),
    ]);

    return {
      items: events.map((event) => InventoryEventResponseDto.fromEntity(event)),
      total,
      limit,
      offset,
    };
  }
}
