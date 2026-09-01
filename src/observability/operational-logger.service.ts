import { Injectable, Logger } from '@nestjs/common';

export type OperationalOutcome = 'success' | 'fallback' | 'failure';

type InventoryAction =
  | 'record_event'
  | 'record_purchase'
  | 'complete_purchase'
  | 'complete_partial_purchase';

type PredictionAction = 'estimate' | 'recommend';

type IntegrationErrorType =
  'provider_error' | 'unexpected_error' | 'domain_error';

type CatalogIntegrityAction = 'lookup' | 'direct_resolution' | 'alias_write';

export interface InventoryActionLog {
  action: InventoryAction;
  outcome: 'success';
  productId?: string;
  inventoryEventId?: string;
  affectedCount?: number;
  skippedCount?: number;
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
    | 'catalog.integrity';
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
    } = input;
    this.write({
      event: 'inventory.action',
      outcome,
      action,
      productId,
      inventoryEventId,
      affectedCount,
      skippedCount,
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
