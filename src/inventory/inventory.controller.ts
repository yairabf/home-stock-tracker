import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { ListInventoryEventsDto } from './dto/list-inventory-events.dto';
import { InventoryEventResponseDto } from './dto/inventory-event-response.dto';
import { InventoryEventListResponseDto } from './dto/inventory-event-list-response.dto';

@Controller('inventory/events')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  recordEvent(
    @Body() dto: RecordInventoryEventDto,
  ): Promise<InventoryEventResponseDto> {
    return this.inventoryService.recordEvent(dto);
  }

  @Get()
  listEvents(
    @Query() query: ListInventoryEventsDto,
  ): Promise<InventoryEventListResponseDto> {
    return this.inventoryService.listEvents(query);
  }
}
