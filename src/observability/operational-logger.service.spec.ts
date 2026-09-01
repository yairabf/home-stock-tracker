import { Logger } from '@nestjs/common';
import { OperationalLogger } from './operational-logger.service';

describe('OperationalLogger', () => {
  let service: OperationalLogger;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    service = new OperationalLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits only allowlisted inventory fields', () => {
    service.inventoryAction({
      action: 'record_event',
      outcome: 'success',
      productId: 'product-id',
      inventoryEventId: 'event-id',
      secret: 'do-not-log',
      body: { note: 'private note' },
    } as never);

    expect(log).toHaveBeenCalledWith({
      event: 'inventory.action',
      outcome: 'success',
      action: 'record_event',
      productId: 'product-id',
      inventoryEventId: 'event-id',
      affectedCount: undefined,
      skippedCount: undefined,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('do-not-log');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private note');
  });

  it('emits allowlisted catalog integrity failures at error level', () => {
    service.catalogIntegrity({
      outcome: 'failure',
      action: 'lookup',
      productIds: ['product-a', 'product-b'],
      normalizedNameFingerprint: 'sha256:1234567890abcdef',
      ownerCount: 2,
      errorType: 'multiple_name_owners',
      rawName: 'private product name',
      databaseError: new Error('provider detail'),
    } as never);

    expect(error).toHaveBeenCalledWith({
      event: 'catalog.integrity',
      outcome: 'failure',
      action: 'lookup',
      productIds: ['product-a', 'product-b'],
      normalizedNameFingerprint: 'sha256:1234567890abcdef',
      ownerCount: 2,
      errorType: 'multiple_name_owners',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(
      'private product name',
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain('provider detail');
  });

  it('uses warn for fallbacks and error for failures', () => {
    service.predictionRun({
      action: 'estimate',
      outcome: 'fallback',
      productId: 'product-id',
    });
    service.llmIntegration({
      outcome: 'failure',
      provider: 'openai',
      errorType: 'provider_error',
    });

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'prediction.run',
        outcome: 'fallback',
      }),
    );
    expect(error).toHaveBeenCalledWith({
      event: 'integration.llm',
      outcome: 'failure',
      provider: 'openai',
      errorType: 'provider_error',
    });
  });
});
