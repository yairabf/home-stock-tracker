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
  Inject,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  PREDICTION_ENGINE,
  type PredictionEngine,
} from '../estimation/prediction-engine';
import { EstimationResponseDto } from './dto/estimation-response.dto';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { RecordPurchaseDto } from './dto/record-purchase.dto';
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

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly predictionFeedbackService: PredictionFeedbackService,
    private readonly lowStockRecommendationService: LowStockRecommendationService,
    @Inject(PREDICTION_ENGINE)
    private readonly predictionEngine: PredictionEngine,
  ) {}

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
  recordPurchase(
    @Body() dto: RecordPurchaseDto,
  ): Promise<InventoryEventResponseDto> {
    return this.inventoryService.recordPurchase({
      ...dto,
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
  ): Promise<EstimationResponseDto> {
    const result = await this.predictionEngine.predictProduct(productId);
    return EstimationResponseDto.fromEstimationResult(result);
  }
}
