import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  @Get()
  @ApiOperation({ summary: 'Get all programs' })
  async findAll(@Query('brandId') brandId: string) {
    // TODO: Implement programs listing
    return {
      message: 'Programs endpoint - implementation pending',
      brandId,
    };
  }
}
