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
import { OperationalLogger } from '../observability/operational-logger.service';
import { TransportSource } from '../common/transport-source';
import { GroceryQuantityMode } from '../grocery/dto/update-grocery-item.dto';
import { PendingGroceryItemPolicy } from '../grocery/dto/add-grocery-item.dto';
import { AddGroceryItemOutcome } from '../grocery/dto/add-grocery-item-result.dto';

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

const groceryAddOutputSchema = z.object({
  outcome: z.enum(AddGroceryItemOutcome),
  createdItem: groceryItemOutputSchema.nullable(),
  existingItems: z.array(groceryItemOutputSchema),
  requestedAddition: z.object({
    requestedQuantity: z.number().nullable(),
    unit: z.string().nullable(),
    note: z.string().nullable(),
  }),
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

const productSelectorSchema = z
  .object({
    id: z.uuid().optional(),
    productName: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(({ id, productName }) => Boolean(id) !== Boolean(productName), {
    message: 'Provide exactly one of id or productName',
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
    private readonly operationalLogger: OperationalLogger,
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
        this.runTool('complete_grocery_purchase', async () =>
          this.toolResult(
            await this.inventoryService.completeGroceryPurchase({
              groceryItemIds,
              source: TransportSource.mcp,
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
        this.runTool('get_low_stock_predictions', async () =>
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
        this.runTool('record_purchase', async () =>
          this.toolResult(
            await this.inventoryService.recordPurchase({
              ...input,
              source: TransportSource.mcp,
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
        this.runTool('record_stock_signal', async () =>
          this.toolResult(
            await this.inventoryService.recordEvent({
              ...input,
              source: TransportSource.mcp,
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
        inputSchema: productSelectorSchema,
        outputSchema: productOutputSchema,
      },
      (input) =>
        this.runTool('get_product', async () =>
          this.toolResult(
            ProductResponseDto.fromEntity(
              input.id
                ? await this.productService.findOne(input.id)
                : await this.productService.findByExactOrAliasName(
                    input.productName!,
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
        this.runTool('get_inventory', async () =>
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
            ifPendingExists: z.enum(PendingGroceryItemPolicy).optional(),
          })
          .strict(),
        outputSchema: groceryAddOutputSchema,
      },
      (input) =>
        this.runTool('grocery_add', async () =>
          this.toolResult(
            await this.groceryService.addItem({
              ...input,
              source: GroceryItemSource.mcp,
            }),
          ),
        ),
    );

    server.registerTool(
      'grocery_update',
      {
        description:
          'Set or increment the quantity of one pending grocery-list item.',
        inputSchema: z
          .object({
            id: z.uuid(),
            quantityMode: z.enum(GroceryQuantityMode),
            quantity: z.number().positive().finite(),
            unit: z.string().trim().min(1).optional(),
            expectedRequestedQuantity: z.number().positive().finite().nullable(),
            expectedUnit: z.string().nullable(),
          })
          .strict(),
        outputSchema: groceryItemOutputSchema,
      },
      ({ id, ...input }) =>
        this.runTool('grocery_update', async () =>
          this.toolResult(await this.groceryService.updateItem(id, input)),
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
        this.runTool('grocery_remove', async () =>
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
        this.runTool('grocery_list', async () =>
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
    tool: string,
    operation: () => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    try {
      return await operation();
    } catch (error) {
      this.operationalLogger.mcpIntegration({
        outcome: 'failure',
        tool,
        errorType:
          error instanceof HttpException ? 'domain_error' : 'unexpected_error',
      });
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
    const code = 'code' in response ? response.code : undefined;
    if (Array.isArray(message)) {
      return message.filter((value) => typeof value === 'string').join(', ');
    }
    const safeMessage = typeof message === 'string' ? message : error.message;
    if ('currentItem' in response && response.currentItem !== undefined) {
      return JSON.stringify({
        code,
        message: safeMessage,
        currentItem: response.currentItem,
      });
    }
    return typeof code === 'string' ? `${code}: ${safeMessage}` : safeMessage;
  }

  private toolError(message: string): CallToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}
