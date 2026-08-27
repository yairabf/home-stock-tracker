import { HttpException, Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GroceryService } from '../grocery/grocery.service';
import { ProductService } from '../product/product.service';
import {
  PREDICTION_ENGINE,
  type PredictionEngine,
} from '../estimation/prediction-engine';
import { ProductResponseDto } from '../product/dto/product-response.dto';
import { EstimationResponseDto } from '../inventory/dto/estimation-response.dto';
import { InventoryService } from '../inventory/inventory.service';
import { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';
import { LowStockRecommendationListResponseDto } from '../inventory/dto/low-stock-recommendation-response.dto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  GroceryItemSource,
  GroceryItemStatus,
  InventoryEventType,
  PredictedState,
  ProductType,
} from '../generated/prisma/enums';

const groceryItemOutputSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  requestedQuantity: z.number().nullable(),
  unit: z.string().nullable(),
  dateAdded: z.string(),
  status: z.enum(GroceryItemStatus),
  note: z.string().nullable(),
  source: z.enum(GroceryItemSource),
  relatedInventoryEventId: z.string().nullable(),
});

const groceryListOutputSchema = z.object({
  items: z.array(groceryItemOutputSchema),
});

const productOutputSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()),
  category: z.string().nullable(),
  typicalUnit: z.string().nullable(),
  productType: z.enum(ProductType).nullable(),
  isPerishable: z.boolean(),
  predictionStrategy: z.string().nullable(),
  predictionEnabled: z.boolean(),
  config: z.json().nullable(),
});

const householdContextSchema = z.object({
  adultsCount: z.number(),
  childrenCount: z.number(),
  childAgeGroups: z.array(z.string()),
  predictionPreferences: z.record(z.string(), z.unknown()).nullable(),
});

const estimationOutputSchema = z.object({
  predictionId: z.string().nullable(),
  productId: z.string(),
  predictedState: z.enum(PredictedState),
  confidenceScore: z.number(),
  reason: z.string(),
  recommendedAction: z.string().nullable(),
  llmContributed: z.boolean(),
  deterministicSignals: z.object({
    lastPurchaseAt: z.string().nullable(),
    lastLowStockSignalAt: z.string().nullable(),
    lastStockConfirmationAt: z.string().nullable(),
    daysSinceLastPurchase: z.number().nullable(),
    daysSinceLastLowSignal: z.number().nullable(),
    productType: z.string().nullable(),
    eventCount: z.number(),
    coldStart: z.boolean(),
    hasLearnedStatistics: z.boolean(),
    avgPurchaseIntervalDays: z.number().nullable(),
    avgNeedIntervalDays: z.number().nullable(),
    estimatedConsumptionIntervalDays: z.number().nullable(),
    observationCount: z.number(),
    isPerishable: z.boolean(),
    predictionStrategy: z.string().nullable(),
    householdContext: householdContextSchema.nullable(),
    authoritativeDirectSignal: z.boolean(),
  }),
});

const inventoryEventOutputSchema = z.object({
  id: z.string(),
  productId: z.string(),
  eventType: z.enum(InventoryEventType),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  timestamp: z.string(),
  source: z.string(),
  confidence: z.number().nullable(),
  metadata: z.json().nullable(),
});

const completeGroceryPurchaseOutputSchema = z.object({
  events: z.array(inventoryEventOutputSchema),
  completedItems: z.array(groceryItemOutputSchema),
});

const recommendationOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      predictionId: z.string().nullable(),
      predictedState: z.enum([
        PredictedState.probably_low,
        PredictedState.probably_out,
      ]),
      confidenceScore: z.number(),
      reason: z.string(),
      recommendedAction: z.string().nullable(),
    }),
  ),
});

const eventMeasurementsSchema = {
  productId: z.uuid(),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
  confidence: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

@Injectable()
export class McpServerFactory {
  constructor(
    private readonly groceryService: GroceryService,
    private readonly productService: ProductService,
    @Inject(PREDICTION_ENGINE)
    private readonly predictionEngine: PredictionEngine,
    private readonly inventoryService: InventoryService,
    private readonly lowStockRecommendationService: LowStockRecommendationService,
  ) {}

  create(): McpServer {
    const server = new McpServer({
      name: 'home-stock-tracker',
      version: '1.0.0',
    });

    this.registerGroceryTools(server);
    this.registerReadTools(server);
    this.registerInventoryWriteTools(server);
    this.registerGroceryPurchaseCompletionTool(server);
    this.registerRecommendationTool(server);
    return server;
  }

  private registerGroceryPurchaseCompletionTool(server: McpServer): void {
    server.registerTool(
      'complete_grocery_purchase',
      {
        description:
          'Complete selected pending grocery items from one shopping trip.',
        inputSchema: z
          .object({
            groceryItemIds: z
              .array(z.uuid())
              .min(1)
              .refine((ids) => new Set(ids).size === ids.length, {
                message: 'Grocery item IDs must be unique',
              }),
          })
          .strict(),
        outputSchema: completeGroceryPurchaseOutputSchema,
      },
      ({ groceryItemIds }) =>
        this.runTool(async () =>
          this.toolResult(
            await this.inventoryService.completeGroceryPurchase({
              groceryItemIds,
              source: 'hermes_mcp',
            }),
          ),
        ),
    );
  }

  private registerRecommendationTool(server: McpServer): void {
    server.registerTool(
      'get_low_stock_predictions',
      {
        description:
          'Get actionable high-confidence low-stock recommendations.',
        inputSchema: z.object({}).strict(),
        outputSchema: recommendationOutputSchema,
      },
      () =>
        this.runTool(async () =>
          this.toolResult(
            LowStockRecommendationListResponseDto.fromDomain(
              await this.lowStockRecommendationService.getRecommendations(),
            ),
          ),
        ),
    );
  }

  private registerInventoryWriteTools(server: McpServer): void {
    server.registerTool(
      'record_purchase',
      {
        description: 'Record a household purchase or restock event.',
        inputSchema: z
          .object({
            ...eventMeasurementsSchema,
            eventType: z.enum([
              InventoryEventType.PURCHASED,
              InventoryEventType.RESTOCKED,
            ]),
          })
          .strict(),
        outputSchema: inventoryEventOutputSchema,
      },
      (input) =>
        this.runTool(async () =>
          this.toolResult(
            await this.inventoryService.recordPurchase({
              ...input,
              source: 'hermes_mcp',
            }),
          ),
        ),
    );

    server.registerTool(
      'record_stock_signal',
      {
        description: 'Record a direct observation of household stock state.',
        inputSchema: z
          .object({
            ...eventMeasurementsSchema,
            eventType: z.enum([
              InventoryEventType.STOCK_LOW,
              InventoryEventType.STOCK_OUT,
              InventoryEventType.STOCK_CONFIRMED,
              InventoryEventType.STOCK_CORRECTED,
            ]),
          })
          .strict(),
        outputSchema: inventoryEventOutputSchema,
      },
      (input) =>
        this.runTool(async () =>
          this.toolResult(
            await this.inventoryService.recordEvent({
              ...input,
              source: 'hermes_mcp',
            }),
          ),
        ),
    );
  }

  private registerReadTools(server: McpServer): void {
    server.registerTool(
      'get_product',
      {
        description: 'Get one canonical product by its ID or exact name/alias.',
        inputSchema: z.union([
          z.object({ id: z.uuid() }).strict(),
          z.object({ productName: z.string().trim().min(1) }).strict(),
        ]),
        outputSchema: productOutputSchema,
      },
      (input) =>
        this.runTool(async () =>
          this.toolResult(
            ProductResponseDto.fromEntity(
              'id' in input
                ? await this.productService.findOne(input.id)
                : await this.productService.findByExactOrAliasName(
                    input.productName,
                  ),
            ),
          ),
        ),
    );

    server.registerTool(
      'get_inventory',
      {
        description: 'Estimate the current inventory state for one product.',
        inputSchema: z.object({ id: z.uuid() }).strict(),
        outputSchema: estimationOutputSchema,
      },
      ({ id }) =>
        this.runTool(async () =>
          this.toolResult(
            EstimationResponseDto.fromEstimationResult(
              await this.predictionEngine.predictProduct(id),
            ),
          ),
        ),
    );
  }

  private registerGroceryTools(server: McpServer): void {
    server.registerTool(
      'grocery_add',
      {
        description: 'Add a product to the household grocery list.',
        inputSchema: z
          .object({
            productName: z.string().trim().min(1),
            requestedQuantity: z.number().positive().optional(),
            unit: z.string().optional(),
            note: z.string().optional(),
          })
          .strict(),
        outputSchema: groceryItemOutputSchema,
      },
      (input) =>
        this.runTool(async () =>
          this.toolResult(
            await this.groceryService.addItem({
              ...input,
              source: GroceryItemSource.hermes_whatsapp,
            }),
          ),
        ),
    );

    server.registerTool(
      'grocery_remove',
      {
        description: 'Remove one grocery-list item by its ID.',
        inputSchema: z.object({ id: z.uuid() }).strict(),
        outputSchema: groceryItemOutputSchema,
      },
      ({ id }) =>
        this.runTool(async () =>
          this.toolResult(await this.groceryService.removeItem(id)),
        ),
    );

    server.registerTool(
      'grocery_list',
      {
        description: 'List grocery items, pending by default.',
        inputSchema: z
          .object({
            status: z.enum(GroceryItemStatus).optional(),
          })
          .strict(),
        outputSchema: groceryListOutputSchema,
      },
      ({ status }) =>
        this.runTool(async () =>
          this.toolResult({
            items: await this.groceryService.listItems(status),
          }),
        ),
    );
  }

  private toolResult(value: unknown) {
    const structuredContent = JSON.parse(JSON.stringify(value)) as Record<
      string,
      unknown
    >;
    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(structuredContent) },
      ],
      structuredContent,
    };
  }

  private async runTool(
    operation: () => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    try {
      return await operation();
    } catch (error) {
      return this.toolError(this.safeErrorMessage(error));
    }
  }

  private safeErrorMessage(error: unknown): string {
    if (!(error instanceof HttpException)) {
      return 'The inventory operation could not be completed';
    }

    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    const message = 'message' in response ? response.message : error.message;
    if (Array.isArray(message)) {
      return message.filter((value) => typeof value === 'string').join(', ');
    }
    return typeof message === 'string' ? message : error.message;
  }

  private toolError(message: string): CallToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}
