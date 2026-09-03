import { BadRequestException, ConflictException } from '@nestjs/common';

export class StockLedgerException extends BadRequestException {
  constructor(message: string) {
    super({ code: 'INVALID_STOCK_FACT', message });
  }
}

export class StockStateConflictException extends ConflictException {
  constructor(message: string) {
    super({ code: 'STOCK_STATE_CONFLICT', message });
  }
}
