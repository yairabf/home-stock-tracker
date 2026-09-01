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
import { ProductSearchResponseDto } from '../product/dto/product-search-response.dto';
import { ProductSearchService } from '../product/product-search.service';
import {
  normalizeProductDisplayName,
  normalizeProductName,
} from '../product/product-name.util';
import {
  PRODUCT_SEARCH_MAX_LIMIT,
  PRODUCT_SEARCH_MAX_QUERY_LENGTH,
} from '../product/types/product-search';
import { EstimationResponseDto } from '../inventory/dto/estimation-response.dto';
import { InventoryService } from '../inventory/inventory.service';
import { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';
import { LowStockRecommendationListResponseDto } from '../inventory/dto/low-stock-recommendation-response.dto';
import { PredictionFeedbackService } from '../inventory/prediction-feedback.service';
import { PredictionFeedbackOutcome } from '../inventory/dto/prediction-feedback.dto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  FeedbackStatus,
  GroceryItemSource,
  GroceryItemStatus,
  InventoryEventType,
  PredictedState,
  ProductType,
} from '../generated/prisma/enums';
import { OperationalLogger } from '../observability/operational-logger.service';
import { TransportSource } from '../common/transport-source';
import {
  PendingGroceryItemPolicy,
  ProductResolutionAction,
  UnknownProductPolicy,
  type PolicyAwareGroceryAddition,
} from '../grocery/types/policy-aware-grocery-addition';
import { productResolutionProposalSchema } from '../product/types/product-resolution';
import {
  confirmNewProductInputSchema,
  confirmProductAliasInputSchema,
} from './schemas/grocery-confirmation.schema';

const groceryItemOutputSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  requestedQuantity: z.number().positive().finite(),
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

const productSearchProductOutputSchema = productOutputSchema.omit({
  predictionStrategy: true,
  config: true,
});

const productSearchOutputSchema = z.object({
  exactMatch: productSearchProductOutputSchema.nullable(),
  candidates: z.array(productSearchProductOutputSchema),
});

const groceryAdditionItemInputSchema = z
  .object({
    requestedQuantity: z.number().positive().finite().optional(),
    unit: z.string().optional(),
    note: z.string().optional(),
    ifPendingExists: z
      .enum(PendingGroceryItemPolicy)
      .default(PendingGroceryItemPolicy.return_existing),
  })
  .strict();

const explicitProductInputSchema = z
  .object({
    canonicalName: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)),
    category: z.string().trim().min(1),
    typicalUnit: z.string().nullable(),
    productType: z.enum(ProductType),
    isPerishable: z.boolean(),
  })
  .strict();

const groceryAddInputSchema = z
  .object({
    unknownProductPolicy: z
      .enum(UnknownProductPolicy)
      .default(UnknownProductPolicy.propose_if_missing),
    productName: z.string().trim().min(1).optional(),
    product: explicitProductInputSchema.optional(),
    groceryItem: groceryAdditionItemInputSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const valid =
      input.unknownProductPolicy === UnknownProductPolicy.create_if_missing
        ? input.product !== undefined && input.productName === undefined
        : input.product === undefined && input.productName !== undefined;
    if (!valid) {
      context.addIssue({
        code: 'custom',
        message: 'Product input must match unknownProductPolicy',
      });
    }
  });

const requestedAdditionOutputSchema = z.object({
  productName: z.string(),
  requestedQuantity: z.number().nullable(),
  unit: z.string().nullable(),
  note: z.string().nullable(),
  ifPendingExists: z.enum(PendingGroceryItemPolicy),
});

const groceryConfirmationOutputSchema = z
  .object({
    outcome: z.enum(['created', 'confirmation_required']),
    createdItem: groceryItemOutputSchema.nullable(),
    existingItems: z.array(groceryItemOutputSchema),
    requestedAddition: requestedAdditionOutputSchema,
  })
  .strict()
  .superRefine((result, context) => {
    const valid =
      result.outcome === 'created'
        ? result.createdItem !== null && result.existingItems.length === 0
        : result.createdItem === null && result.existingItems.length > 0;
    if (!valid) {
      context.addIssue({
        code: 'custom',
        message: 'Invalid grocery confirmation result',
      });
    }
  });

const groceryAddOutputSchema = z
  .object({
    outcome: z.enum([
      'created',
      'confirmation_required',
      'product_resolution_required',
    ]),
    createdItem: groceryItemOutputSchema.nullable().optional(),
    existingItems: z.array(groceryItemOutputSchema).optional(),
    requestedAddition: requestedAdditionOutputSchema,
    candidates: z.array(productSearchProductOutputSchema).optional(),
    proposal: productResolutionProposalSchema.nullable().optional(),
    allowedActions: z.array(z.enum(ProductResolutionAction)).optional(),
  })
  .strict()
  .superRefine((result, context) => {
    const valid =
      result.outcome === 'created'
        ? result.createdItem != null && result.existingItems !== undefined
        : result.outcome === 'confirmation_required'
          ? result.createdItem === null && result.existingItems !== undefined
          : result.candidates !== undefined &&
            result.proposal !== undefined &&
            result.allowedActions !== undefined;
    if (!valid) {
      context.addIssue({
        code: 'custom',
        message: 'Invalid grocery add result',
      });
    }
  });

function mcpGroceryAddition(
  input: z.output<typeof groceryAddInputSchema>,
): PolicyAwareGroceryAddition {
  if (input.unknownProductPolicy === UnknownProductPolicy.create_if_missing) {
    if (!input.product) {
      throw new Error('Validated create_if_missing input has no product');
    }
    return {
      unknownProductPolicy: UnknownProductPolicy.create_if_missing,
      product: input.product,
      groceryItem: input.groceryItem,
      source: GroceryItemSource.mcp,
    };
  }
  if (!input.productName) {
    throw new Error('Validated propose_if_missing input has no productName');
  }
  return {
    unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
    productName: input.productName,
    groceryItem: input.groceryItem,
    source: GroceryItemSource.mcp,
  };
}

const productSearchInputSchema = z
  .object({
    query: z
      .string()
      .transform(normalizeProductDisplayName)
      .pipe(
        z
          .string()
          .min(1)
          .refine(
            (query) => [...query].length <= PRODUCT_SEARCH_MAX_QUERY_LENGTH,
            `Query must contain at most ${PRODUCT_SEARCH_MAX_QUERY_LENGTH} characters`,
          ),
      )
      .transform(normalizeProductName),
    limit: z.number().int().min(1).max(PRODUCT_SEARCH_MAX_LIMIT).optional(),
  })
  .strict();

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

const concretePredictedStateSchema = z.enum([
  PredictedState.likely_available,
  PredictedState.probably_low,
  PredictedState.probably_out,
]);

const predictionFeedbackInputSchema = z
  .object({
    predictionId: z.uuid(),
    outcome: z.enum(PredictionFeedbackOutcome),
    correctedState: concretePredictedStateSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const isCorrection = input.outcome === PredictionFeedbackOutcome.corrected;
    if (isCorrection && input.correctedState === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['correctedState'],
        message: 'correctedState is required for corrected feedback',
      });
    }
    if (!isCorrection && input.correctedState !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['correctedState'],
        message: 'correctedState is only allowed for corrected feedback',
      });
    }
  });

const predictionFeedbackOutputSchema = z.object({
  predictionId: z.uuid(),
  productId: z.uuid(),
  feedbackStatus: z.enum([FeedbackStatus.accepted, FeedbackStatus.rejected]),
  outcome: z.enum(PredictionFeedbackOutcome),
  correctedState: concretePredictedStateSchema.nullable(),
  feedbackEventId: z.uuid(),
  predictionAccuracy: z.number(),
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
    private readonly productSearchService: ProductSearchService,
    @Inject(PREDICTION_ENGINE)
    private readonly predictionEngine: PredictionEngine,
    private readonly inventoryService: InventoryService,
    private readonly predictionFeedbackService: PredictionFeedbackService,
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

    server.registerTool(
      'record_prediction_feedback',
      {
        description:
          'Accept, reject, or correct one exact prediction using a non-null prediction ID from the active interaction or a fresh prediction read. Do not guess or reuse an unrelated prediction ID.',
        inputSchema: predictionFeedbackInputSchema,
        outputSchema: predictionFeedbackOutputSchema,
      },
      ({ predictionId, ...feedback }) =>
        this.runTool('record_prediction_feedback', async () =>
          this.toolResult(
            await this.predictionFeedbackService.submitFeedback(predictionId, {
              ...feedback,
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
      'search_products',
      {
        description:
          'Deterministically search the read-only product catalog. Present multiple plausible candidates to the user instead of silently choosing one.',
        inputSchema: productSearchInputSchema,
        outputSchema: productSearchOutputSchema,
      },
      (input) =>
        this.runTool('search_products', async () =>
          this.toolResult(
            ProductSearchResponseDto.fromContract(
              await this.productSearchService.search(input),
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
        description:
          'Add a product to the household grocery list. Omitted unknownProductPolicy uses propose_if_missing: begin uncertain names there and present product_resolution_required candidates or advice without mutation. Use explicit create_if_missing only with complete deterministic product facts. An omitted grocery quantity defaults to 1 only for a new line; confirmation_required never changes an existing quantity.',
        inputSchema: groceryAddInputSchema,
        outputSchema: groceryAddOutputSchema,
      },
      (input) =>
        this.runTool('grocery_add', async () =>
          this.toolResult(
            await this.groceryService.addPolicyAwareItem(
              mcpGroceryAddition(input),
            ),
          ),
        ),
    );

    server.registerTool(
      'grocery_confirm_new_product',
      {
        description:
          'Apply a user-approved final product-creation payload and complete the original grocery addition without an LLM call. Do not send proposal state or source. An omitted quantity defaults to 1 only for a new line. confirmation_required means an existing pending quantity was not changed; handle that as a separate user decision. PRODUCT_NAME_CONFLICT is final for this decision and must not be auto-retried.',
        inputSchema: confirmNewProductInputSchema,
        outputSchema: groceryConfirmationOutputSchema,
      },
      (input) =>
        this.runTool('grocery_confirm_new_product', async () =>
          this.toolResult(
            await this.groceryService.confirmNewProduct({
              ...input,
              source: GroceryItemSource.mcp,
            }),
          ),
        ),
    );

    server.registerTool(
      'grocery_confirm_product_alias',
      {
        description:
          'Apply a user-approved alias to one exact target product ID and complete the original grocery addition without an LLM call. Do not infer the target, send proposal state, or send source. The alias stays saved if confirmation_required reports an existing pending line; quantity remains a separate user decision. PRODUCT_NOT_FOUND and PRODUCT_NAME_CONFLICT are final for this decision and must not be auto-retried.',
        inputSchema: confirmProductAliasInputSchema,
        outputSchema: groceryConfirmationOutputSchema,
      },
      (input) =>
        this.runTool('grocery_confirm_product_alias', async () =>
          this.toolResult(
            await this.groceryService.confirmProductAlias({
              ...input,
              source: GroceryItemSource.mcp,
            }),
          ),
        ),
    );

    server.registerTool(
      'grocery_set_quantity',
      {
        description:
          'Set one pending grocery item to an absolute final quantity. Calculate relative requests before calling and copy expectedRequestedQuantity from the latest grocery_list result. GROCERY_ITEM_CHANGED requires a fresh user decision: do not retry or recalculate automatically. Make no call when the chosen final quantity is unchanged.',
        inputSchema: z
          .object({
            itemId: z.uuid(),
            requestedQuantity: z.number().positive().finite(),
            expectedRequestedQuantity: z.number().positive().finite(),
          })
          .strict(),
        outputSchema: groceryItemOutputSchema,
      },
      ({ itemId, requestedQuantity, expectedRequestedQuantity }) =>
        this.runTool('grocery_set_quantity', async () =>
          this.toolResult(
            await this.groceryService.setQuantity(itemId, {
              requestedQuantity,
              expectedRequestedQuantity,
            }),
          ),
        ),
    );

    server.registerTool(
      'grocery_update',
      {
        description:
          'Update unit, note, or intentional combinations of fields on one pending grocery item using expected old values. Prefer grocery_set_quantity for quantity-only changes.',
        inputSchema: z
          .object({
            id: z.uuid(),
            requestedQuantity: z.number().positive().finite().optional(),
            expectedRequestedQuantity: z
              .number()
              .positive()
              .finite()
              .optional(),
            unit: z.string().trim().min(1).nullable().optional(),
            expectedUnit: z.string().nullable().optional(),
            note: z.string().trim().min(1).nullable().optional(),
            expectedNote: z.string().nullable().optional(),
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
