import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { DatabaseService } from './infrastructure/database.service';

@Controller()
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('health')
  @Version(VERSION_NEUTRAL)
  health() {
    return { status: 'ok', service: 'landing-content' };
  }

  @Get('ready')
  @Version(VERSION_NEUTRAL)
  async ready() {
    await this.databaseService.ping();
    return { status: 'ready' };
  }
}
