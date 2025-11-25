import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  @Get()
  @ApiOperation({ summary: 'Get all applications' })
  async findAll(@Query('brandId') brandId: string) {
    // TODO: Implement applications listing
    return {
      message: 'Applications endpoint - implementation pending',
      brandId,
    };
  }
}
