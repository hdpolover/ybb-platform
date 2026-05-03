import { Controller, Get, Header, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { register } from 'prom-client';

@Controller()
export class MetricsController {
  @Get('metrics')
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
