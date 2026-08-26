import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { RecordPurchaseDto } from './dto/record-purchase.dto';
import { ListInventoryEventsDto } from './dto/list-inventory-events.dto';
import { InventoryEventResponseDto } from './dto/inventory-event-response.dto';
import { InventoryEventListResponseDto } from './dto/inventory-event-list-response.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('events')
  recordEvent(
    @Body() dto: RecordInventoryEventDto,
  ): Promise<InventoryEventResponseDto> {
    return this.inventoryService.recordEvent(dto);
  }

  @Post('purchases')
  recordPurchase(
    @Body() dto: RecordPurchaseDto,
  ): Promise<InventoryEventResponseDto> {
    return this.inventoryService.recordPurchase(dto);
  }

  @Get('events')
  listEvents(
    @Query() query: ListInventoryEventsDto,
  ): Promise<InventoryEventListResponseDto> {
    return this.inventoryService.listEvents(query);
  }
}
