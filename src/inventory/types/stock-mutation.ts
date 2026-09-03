export enum StockMutationOperation {
  set = 'set',
  decrement = 'decrement',
  mark_out = 'mark_out',
}

interface StockMutationBase {
  productId: string;
  source: string;
}

export interface SetStockMutation extends StockMutationBase {
  operation: StockMutationOperation.set;
  quantity: number;
  unit?: string;
}

export interface DecrementStockMutation extends StockMutationBase {
  operation: StockMutationOperation.decrement;
  quantity: number;
  unit?: string;
}

export interface MarkOutStockMutation extends StockMutationBase {
  operation: StockMutationOperation.mark_out;
}

export type StockMutation =
  SetStockMutation | DecrementStockMutation | MarkOutStockMutation;
