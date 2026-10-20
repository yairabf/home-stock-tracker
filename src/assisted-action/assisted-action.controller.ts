import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AssistedActionService } from './assisted-action.service';
import type { AssistedActionWireResult } from './assisted-action-response.schema';

@Controller('inventory/assisted-actions')
export class AssistedActionController {
  constructor(private readonly actions: AssistedActionService) {}

  @Post()
  @HttpCode(200)
  apply(@Body() body: unknown): Promise<AssistedActionWireResult> {
    return this.actions.apply(body, 'api');
  }
}
