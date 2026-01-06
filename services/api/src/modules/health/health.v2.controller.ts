import { Controller, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthV2Controller {
  @Version('2')
  @Get()
  @ApiOperation({ summary: 'V2 Health check endpoint (Beta)' })
  @ApiResponse({ status: 200, description: 'Return V2 health status with extended validation' })
  check() {
    return {
      status: 'ok',
      version: '2.0.0-beta',
      features: ['advanced-diagnostics', 'realtime-metrics'],
      timestamp: new Date().toISOString(),
    };
  }
}
