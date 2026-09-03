import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  STOCK_WORKFLOW_CONFIG,
  type StockWorkflowConfig,
} from '../config/application-config';
import { DailyStockWorkflowService } from './daily-stock-workflow.service';

export const STOCK_WORKFLOW_JOB = 'daily-stock-estimation';

@Injectable()
export class StockWorkflowSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly config: StockWorkflowConfig;
  private job: CronJob | null = null;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly workflow: DailyStockWorkflowService,
    @Inject(STOCK_WORKFLOW_CONFIG)
    config: StockWorkflowConfig,
  ) {
    this.config = config;
  }

  onModuleInit(): void {
    if (!this.config.enabled) return;

    this.job = CronJob.from({
      cronTime: this.config.cron,
      timeZone: this.config.timezone,
      waitForCompletion: true,
      start: false,
      onTick: async () => {
        await this.workflow.run();
      },
    });
    this.schedulerRegistry.addCronJob(STOCK_WORKFLOW_JOB, this.job);
    this.job.start();
  }

  onModuleDestroy(): void {
    if (!this.job) return;
    this.job.stop();
    this.schedulerRegistry.deleteCronJob(STOCK_WORKFLOW_JOB);
    this.job = null;
  }
}
