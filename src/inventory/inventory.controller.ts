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

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly predictionFeedbackService: PredictionFeedbackService,
    @Inject(PREDICTION_ENGINE)
    private readonly predictionEngine: PredictionEngine,
  ) {}

  @Post('predictions/:predictionId/feedback')
  feedback(
    @Param('predictionId', new ParseUUIDPipe()) predictionId: string,
    @Body() dto: PredictionFeedbackDto,
  ): Promise<PredictionFeedbackResponseDto> {
    return this.predictionFeedbackService.submitFeedback(predictionId, dto);
  }

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

  @Post('purchases/complete')
  @HttpCode(HttpStatus.CREATED)
  completePurchase(
    @Body() dto: CompletePurchaseDto,
  ): Promise<CompletePurchaseResponseDto> {
    return this.inventoryService.completePurchase(dto);
  }

  @Post('purchases/complete-partial')
  @HttpCode(HttpStatus.CREATED)
  completePartialPurchase(
    @Body() dto: CompletePartialPurchaseDto,
  ): Promise<CompletePartialPurchaseResponseDto> {
    return this.inventoryService.completePartialPurchase(dto);
  }

  @Get('estimate/:productId')
  async estimateInventory(
    @Param('productId') productId: string,
  ): Promise<EstimationResponseDto> {
    const result = await this.predictionEngine.predictProduct(productId);
    return EstimationResponseDto.fromEstimationResult(result);
  }
}
