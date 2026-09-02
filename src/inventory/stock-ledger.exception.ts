import { BadRequestException } from '@nestjs/common';

export class StockLedgerException extends BadRequestException {
  constructor(message: string) {
    super({ code: 'INVALID_STOCK_FACT', message });
  }
}
