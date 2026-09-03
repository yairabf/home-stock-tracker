import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { ListInventoryEventsDto } from './dto/list-inventory-events.dto';
import { InventoryEventResponseDto } from './dto/inventory-event-response.dto';
import { InventoryEventListResponseDto } from './dto/inventory-event-list-response.dto';
import { CompletePurchaseDto } from './dto/complete-purchase.dto';
import { CompletePurchaseResponseDto } from './dto/complete-purchase-response.dto';
import { CompletePartialPurchaseDto } from './dto/complete-partial-purchase.dto';
import { CompletePartialPurchaseResponseDto } from './dto/complete-partial-purchase-response.dto';
import { PredictionFeedbackDto } from './dto/prediction-feedback.dto';
import { PredictionFeedbackResponseDto } from './dto/prediction-feedback-response.dto';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { LowStockRecommendationService } from './low-stock-recommendation.service';
import { LowStockRecommendationListResponseDto } from './dto/low-stock-recommendation-response.dto';
import { TransportSource } from '../common/transport-source';
import { RecordPurchasesDto } from './dto/record-purchases.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import {
  RecordPurchasesResponseDto,
  StockMutationResponseDto,
} from './dto/stock-mutation-response.dto';
import { StockMutationOperation } from './types/stock-mutation';
import {
  HouseholdInventoryResponseDto,
  InventoryEstimateResponseDto,
} from './dto/inventory-read-response.dto';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly predictionFeedbackService: PredictionFeedbackService,
    private readonly lowStockRecommendationService: LowStockRecommendationService,
  ) {}

  @Get()
  listInventory(): Promise<HouseholdInventoryResponseDto> {
    return this.inventoryService.listInventory();
  }

  @Get('predictions/low-stock')
  async getLowStockRecommendations(): Promise<LowStockRecommendationListResponseDto> {
    const recommendations =
      await this.lowStockRecommendationService.getRecommendations();
    return LowStockRecommendationListResponseDto.fromDomain(recommendations);
  }

  @Post('predictions/:predictionId/feedback')
  feedback(
    @Param('predictionId', new ParseUUIDPipe()) predictionId: string,
    @Body() dto: PredictionFeedbackDto,
  ): Promise<PredictionFeedbackResponseDto> {
    return this.predictionFeedbackService.submitFeedback(predictionId, {
      ...dto,
      source: TransportSource.api,
    });
  }

  @Post('events')
  recordEvent(
    @Body() dto: RecordInventoryEventDto,
  ): Promise<InventoryEventResponseDto> {
    return this.inventoryService.recordEvent({
      ...dto,
      source: TransportSource.api,
    });
  }

  @Post('purchases')
  @HttpCode(HttpStatus.CREATED)
  recordPurchase(
    @Body() dto: RecordPurchasesDto,
  ): Promise<InventoryEventResponseDto | RecordPurchasesResponseDto> {
    if (dto.items !== undefined) {
      return this.inventoryService.recordPurchases({
        items: dto.items,
        purchasedAt: dto.purchasedAt,
        source: TransportSource.api,
      });
    }
    return this.inventoryService.recordPurchase({
      productId: dto.productId!,
      eventType: dto.eventType!,
      quantity: dto.quantity,
      unit: dto.unit,
      confidence: dto.confidence,
      metadata: dto.metadata,
      purchasedAt: dto.purchasedAt,
      source: TransportSource.api,
    });
  }

  @Post('stock/:productId')
  @HttpCode(HttpStatus.CREATED)
  updateStock(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: UpdateStockDto,
  ): Promise<StockMutationResponseDto> {
    if (dto.operation === StockMutationOperation.mark_out) {
      return this.inventoryService.updateStock({
        productId,
        operation: dto.operation,
        source: TransportSource.api,
      });
    }
    return this.inventoryService.updateStock({
      productId,
      operation: dto.operation,
      quantity: dto.quantity!,
      unit: dto.unit,
      source: TransportSource.api,
    });
  }

  @Get('events')
  listEvents(
    @Query() query: ListInventoryEventsDto,
  ): Promise<InventoryEventListResponseDto> {
    return this.inventoryService.listEvents(query);
  }

  @Post('purchases/complete')
  @HttpCode(HttpStatus.CREATED)
  completePurchase(
    @Body() dto: CompletePurchaseDto,
  ): Promise<CompletePurchaseResponseDto> {
    return this.inventoryService.completePurchase({
      ...dto,
      source: TransportSource.api,
    });
  }

  @Post('purchases/complete-partial')
  @HttpCode(HttpStatus.CREATED)
  completePartialPurchase(
    @Body() dto: CompletePartialPurchaseDto,
  ): Promise<CompletePartialPurchaseResponseDto> {
    return this.inventoryService.completePartialPurchase({
      ...dto,
      source: TransportSource.api,
    });
  }

  @Get('estimate/:productId')
  async estimateInventory(
    @Param('productId') productId: string,
  ): Promise<InventoryEstimateResponseDto> {
    return this.inventoryService.getInventory(productId);
  }
}
