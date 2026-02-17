import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AiBotService } from './ai-bot.service';
import { CreateAiBotConfigDto } from './dtos/create-ai-bot.dto';
import { UpdateAiBotConfigDto } from './dtos/update-ai-bot.dto';
import { ChangeType } from '@prisma/client';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
// import { AdminGuard } from '../../core/guards/admin.guard';
// import { Public } from '../../core/decorators/public.decorator';

@ApiTags('AI Bot')
@Controller('ai-bot')
export class AiBotController {
  constructor(private readonly aiBotService: AiBotService) { }

  @Post()
  @AuditTrail({ entityType: 'AiChatBotConfig', action: ChangeType.create })
  @ApiOperation({ summary: 'Create new AI Bot configuration (Admin)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Created successfully' })
  // @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateAiBotConfigDto) {
    return this.aiBotService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all bot configurations (Admin)' })
  // @UseGuards(JwtAuthGuard, AdminGuard)
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.aiBotService.findAll(Number(page), Number(limit));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active bot config for frontend' })
  @ApiQuery({ name: 'brandId', required: false, description: 'Brand ID context' })
  // @Public()
  async getActive(@Query('brandId') brandId?: string) {
    return this.aiBotService.getActiveConfig(brandId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a config' })
  findOne(@Param('id') id: string) {
    return this.aiBotService.findOne(id);
  }

  @Patch(':id')
  @AuditTrail({ entityType: 'AiChatBotConfig', action: ChangeType.update })
  @ApiOperation({ summary: 'Update configuration' })
  update(@Param('id') id: string, @Body() dto: UpdateAiBotConfigDto) {
    return this.aiBotService.update(id, dto);
  }

  @Delete(':id')
  @AuditTrail({ entityType: 'AiChatBotConfig', action: ChangeType.delete })
  @ApiOperation({ summary: 'Delete configuration' })
  remove(@Param('id') id: string) {
    return this.aiBotService.remove(id);
  }
}
