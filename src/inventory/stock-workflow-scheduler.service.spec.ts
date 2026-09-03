import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  STOCK_WORKFLOW_JOB,
  StockWorkflowSchedulerService,
} from './stock-workflow-scheduler.service';
import { loadStockWorkflowConfig } from '../config/application-config';
import type { DailyStockWorkflowService } from './daily-stock-workflow.service';

describe('StockWorkflowSchedulerService', () => {
  const addCronJob = jest.fn();
  const deleteCronJob = jest.fn();
  const registry = {
    addCronJob,
    deleteCronJob,
  } as unknown as SchedulerRegistry;
  const run = jest.fn().mockResolvedValue(undefined);
  const workflow = { run } as unknown as DailyStockWorkflowService;

  beforeEach(() => jest.clearAllMocks());

  it('does not register a job when scheduling is disabled', () => {
    const scheduler = new StockWorkflowSchedulerService(
      registry,
      workflow,
      loadStockWorkflowConfig({ STOCK_WORKFLOW_ENABLED: 'false' }),
    );

    scheduler.onModuleInit();

    expect(addCronJob).not.toHaveBeenCalled();
  });

  it('registers the configured cron job and invokes one workflow run', async () => {
    jest.spyOn(CronJob.prototype, 'start').mockImplementation(() => undefined);
    jest.spyOn(CronJob.prototype, 'stop').mockImplementation(() => undefined);
    const scheduler = new StockWorkflowSchedulerService(
      registry,
      workflow,
      loadStockWorkflowConfig({
        STOCK_WORKFLOW_CRON: '15 4 * * *',
        STOCK_WORKFLOW_TIMEZONE: 'UTC',
      }),
    );

    scheduler.onModuleInit();

    const registeredCall = addCronJob.mock.calls[0] as [string, CronJob];
    const job = registeredCall[1];
    await job.fireOnTick();
    expect(addCronJob).toHaveBeenCalledWith(STOCK_WORKFLOW_JOB, job);
    expect(job.cronTime.source).toBe('15 4 * * *');
    expect(job.cronTime.timeZone).toBe('UTC');
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.onModuleDestroy();
    expect(deleteCronJob).toHaveBeenCalledWith(STOCK_WORKFLOW_JOB);
  });

  it.each([
    [{ STOCK_WORKFLOW_CRON: 'not a cron' }, 'cron'],
    [{ STOCK_WORKFLOW_TIMEZONE: 'Not/A_Timezone' }, 'timezone'],
  ])('rejects invalid %s configuration at construction', (environment) => {
    expect(
      () =>
        new StockWorkflowSchedulerService(
          registry,
          workflow,
          loadStockWorkflowConfig(environment),
        ),
    ).toThrow();
  });
});
