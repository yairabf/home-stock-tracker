import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client';
import { inputEvents, type StockCase } from './dataset';
import type { WorkflowSnapshot } from './workflow-dataset';
import { calculateStatistics } from '../../statistics/statistics-calculation';

export function assertWorkflowDatabase(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !/^home_stock_eval_[a-z0-9_]+_test$/.test(name)
  )
    throw new Error(
      'Workflow evaluation requires an explicitly named local isolated test database',
    );
  return name;
}
export async function assertEmptyDatabase(prisma: PrismaClient) {
  const counts = await Promise.all([
    prisma.product.count(),
    prisma.household.count(),
    prisma.inventoryEvent.count(),
    prisma.prediction.count(),
    prisma.groceryListItem.count(),
    prisma.stockProjection.count(),
  ]);
  if (counts.some((n) => n > 0))
    throw new Error('Workflow evaluation refuses nonempty databases');
}
export async function seedWorkflowCase(
  prisma: PrismaClient,
  c: StockCase,
  s: WorkflowSnapshot,
) {
  const household = await prisma.household.findFirst();
  const context = {
    adultsCount: c.household.adultsCount,
    childrenCount: c.household.childrenCount,
    childAgeGroups: [],
    suggestionConfidenceThreshold: s.confidenceThreshold,
  };
  if (household)
    await prisma.household.update({
      where: { id: household.id },
      data: context,
    });
  else await prisma.household.create({ data: context });
  const productId = randomUUID();
  const name = `evaluation-${productId}`;
  await prisma.product.create({
    data: {
      id: productId,
      productType: c.product.productType,
      isPerishable: c.product.isPerishable,
      predictionEnabled: c.product.predictionEnabled,
      predictionStrategy: c.product.predictionStrategy,
      names: {
        create: { displayName: name, normalizedName: name, kind: 'canonical' },
      },
    },
  });
  const events = inputEvents(c);
  const prefix = randomUUID().slice(0, 24);
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  const eventIds = new Map(
    sorted.map((e, i) => [
      e.id,
      `${prefix}${(i + 1).toString(16).padStart(12, '0')}`,
    ]),
  );
  await prisma.inventoryEvent.createMany({
    data: events.map((e) => ({
      id: eventIds.get(e.id)!,
      productId,
      eventType: e.eventType,
      timestamp: new Date(e.occurredAt),
      quantity: e.quantity,
      unit: e.unit,
      source: 'evaluation_fixture',
    })),
  });
  const statistics = calculateStatistics(
    events.map((e) => ({
      eventType: e.eventType,
      timestamp: new Date(e.occurredAt),
      quantity: e.quantity,
    })),
    c.household.adultsCount + c.household.childrenCount,
  );
  await prisma.productStatistics.create({ data: { productId, ...statistics } });
  if (s.policy)
    await prisma.productShelfLifePolicy.create({
      data: { productId, ...s.policy, evaluatedAt: new Date(s.knownAt) },
    });
  await prisma.stockProjection.create({
    data: {
      productId,
      unit: s.unit,
      recordedQuantity: s.recordedQuantity,
      estimatedQuantity: s.estimatedQuantity,
      recordedAt: new Date(s.recordedAt),
      recordedSource: 'evaluation_fixture',
      recordedEventId: eventIds.get(s.recordedEventId)!,
      estimatedState: 'uncertain',
      confidence: 0,
      reason: 'evaluation_fixture',
      evaluatedAt: new Date(s.previousEvaluatedAt),
      revision: s.revision,
    },
  });
  if (s.pendingGrocery)
    await prisma.groceryListItem.create({
      data: { productId, requestedQuantity: 1, source: 'api' },
    });
  return productId;
}
