import { randomUUID } from 'node:crypto';
import {
  assistedActionMcpInputSchema,
  assistedActionMcpOutputSchema,
} from './assisted-action-mcp.schema';

describe('Assisted MCP object schemas', () => {
  it.each(['grocery_add', 'stock_set', 'purchase'])(
    'accepts %s without injecting grocery defaults into other operations',
    (operation) => {
      const input = {
        requestId: randomUUID(),
        operation,
        items: [{ productName: '3% milk by Nestle', quantity: 2 }],
      };
      expect(assistedActionMcpInputSchema.parse(input)).toEqual(input);
    },
  );
  it.each([
    { operation: 'stock_set', items: [{ productName: 'milk' }] },
    {
      operation: 'purchase',
      items: [{ productName: 'milk', quantity: 2, note: 'grocery only' }],
    },
    {
      operation: 'stock_set',
      items: [{ productName: 'milk', productId: randomUUID(), quantity: 2 }],
    },
    {
      operation: 'grocery_add',
      items: [{ productName: 'milk', purchasedAt: '2026-01-01T00:00:00Z' }],
    },
  ])('rejects operation-incompatible input %#', (input) => {
    expect(
      assistedActionMcpInputSchema.safeParse({
        requestId: randomUUID(),
        ...input,
      }).success,
    ).toBe(false);
  });
  it('rejects incomplete success and mixed response variants', () => {
    expect(
      assistedActionMcpOutputSchema.safeParse({
        requestId: randomUUID(),
        outcome: 'applied',
      }).success,
    ).toBe(false);
    expect(
      assistedActionMcpOutputSchema.safeParse({
        requestId: randomUUID(),
        outcome: 'unavailable',
        retryable: true,
        code: 'provider_unavailable',
        issues: [{ inputIndex: 0, code: 'missing_unit' }],
      }).success,
    ).toBe(false);
  });
});
