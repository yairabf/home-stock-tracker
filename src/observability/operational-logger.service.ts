import { Injectable, Logger } from '@nestjs/common';

export type OperationalOutcome = 'success' | 'fallback' | 'failure';

type InventoryAction =
  | 'record_event'
  | 'record_purchase'
  | 'update_stock'
  | 'complete_purchase'
  | 'complete_partial_purchase'
  | 'recalculate_statistics';

type PredictionAction = 'estimate' | 'recommend';

type IntegrationErrorType =
  'provider_error' | 'unexpected_error' | 'domain_error';

type CatalogIntegrityAction = 'lookup' | 'direct_resolution' | 'alias_write';

interface WorkflowPhaseCounts {
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface StockWorkflowLog {
  stage: 'start' | 'end' | 'product_failure';
  outcome: 'success' | 'failure';
  phase?: 'shelf_life' | 'evaluation';
  productId?: string;
  durationMs?: number;
  shelfLife?: WorkflowPhaseCounts;
  evaluation?: WorkflowPhaseCounts;
}

export interface InventoryActionLog {
  action: InventoryAction;
  outcome: 'success' | 'failure';
  productId?: string;
  inventoryEventId?: string;
  affectedCount?: number;
  skippedCount?: number;
  errorType?: 'persistence_error';
}

export interface PredictionRunLog {
  action: PredictionAction;
  outcome: 'success' | 'fallback' | 'failure';
  productId: string;
  predictionId?: string;
}

export interface PredictionPersistenceLog {
  outcome: 'success' | 'failure';
  productId: string;
  predictionId?: string;
  errorType?: 'persistence_error';
}

export interface LlmIntegrationLog {
  outcome: 'fallback' | 'failure';
  provider: 'openai';
  errorType: IntegrationErrorType;
}

export interface McpIntegrationLog {
  outcome: 'failure';
  tool: string;
  errorType: IntegrationErrorType;
}

export interface CatalogIntegrityLog {
  outcome: 'failure';
  action: CatalogIntegrityAction;
  productIds: string[];
  normalizedNameFingerprint: string;
  ownerCount: number;
  errorType: 'multiple_name_owners';
}

interface OperationalEvent {
  event:
    | 'inventory.action'
    | 'prediction.run'
    | 'prediction.persistence'
    | 'integration.llm'
    | 'integration.mcp'
    | 'catalog.integrity'
    | 'stock.workflow';
  outcome: OperationalOutcome;
  action?: InventoryAction | PredictionAction | CatalogIntegrityAction;
  productId?: string;
  productIds?: string[];
  inventoryEventId?: string;
  predictionId?: string;
  affectedCount?: number;
  skippedCount?: number;
  provider?: 'openai';
  tool?: string;
  normalizedNameFingerprint?: string;
  ownerCount?: number;
  errorType?:
    IntegrationErrorType | 'persistence_error' | 'multiple_name_owners';
  stage?: 'start' | 'end' | 'product_failure';
  phase?: 'shelf_life' | 'evaluation';
  durationMs?: number;
  shelfLife?: WorkflowPhaseCounts;
  evaluation?: WorkflowPhaseCounts;
}

@Injectable()
export class OperationalLogger {
  private readonly logger = new Logger(OperationalLogger.name);

  inventoryAction(input: InventoryActionLog): void {
    const {
      action,
      outcome,
      productId,
      inventoryEventId,
      affectedCount,
      skippedCount,
      errorType,
    } = input;
    this.write({
      event: 'inventory.action',
      outcome,
      action,
      productId,
      inventoryEventId,
      affectedCount,
      skippedCount,
      errorType,
    });
  }

  predictionRun(input: PredictionRunLog): void {
    const { action, outcome, productId, predictionId } = input;
    this.write({
      event: 'prediction.run',
      outcome,
      action,
      productId,
      predictionId,
    });
  }

  predictionPersistence(input: PredictionPersistenceLog): void {
    const { outcome, productId, predictionId, errorType } = input;
    this.write({
      event: 'prediction.persistence',
      outcome,
      productId,
      predictionId,
      errorType,
    });
  }

  llmIntegration(input: LlmIntegrationLog): void {
    const { outcome, provider, errorType } = input;
    this.write({
      event: 'integration.llm',
      outcome,
      provider,
      errorType,
    });
  }

  mcpIntegration(input: McpIntegrationLog): void {
    const { outcome, tool, errorType } = input;
    this.write({
      event: 'integration.mcp',
      outcome,
      tool,
      errorType,
    });
  }

  catalogIntegrity(input: CatalogIntegrityLog): void {
    const {
      outcome,
      action,
      productIds,
      normalizedNameFingerprint,
      ownerCount,
      errorType,
    } = input;
    this.write({
      event: 'catalog.integrity',
      outcome,
      action,
      productIds,
      normalizedNameFingerprint,
      ownerCount,
      errorType,
    });
  }

  stockWorkflow(input: StockWorkflowLog): void {
    const {
      stage,
      outcome,
      phase,
      productId,
      durationMs,
      shelfLife,
      evaluation,
    } = input;
    this.write({
      event: 'stock.workflow',
      stage,
      outcome,
      phase,
      productId,
      durationMs,
      shelfLife,
      evaluation,
    });
  }

  private write(event: OperationalEvent): void {
    if (event.outcome === 'failure') {
      this.logger.error(event);
      return;
    }
    if (event.outcome === 'fallback') {
      this.logger.warn(event);
      return;
    }
    this.logger.log(event);
  }
}
