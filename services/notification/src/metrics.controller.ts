import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor() {
    collectDefaultMetrics();
  }

  @Get()
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus formatted metrics' })
  async getMetrics(@Res() res: Response) {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  }
}
