import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AiBotService } from './ai-bot.service';
import { CreateAiBotConfigDto } from './dtos/create-ai-bot.dto';
import { UpdateAiBotConfigDto } from './dtos/update-ai-bot.dto';
import { ChangeType } from '@prisma/client';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';
import { Public } from '../../shared/decorators/public.decorator';

@ApiTags('AI Bot')
@Controller('ai-bot')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AiBotController {
  constructor(private readonly aiBotService: AiBotService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @AuditTrail({ entityType: 'AiChatBotConfig', action: ChangeType.create })
  @ApiOperation({ summary: 'Create new AI Bot configuration (Admin)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Created successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden – admin role required' })
  create(@Body() dto: CreateAiBotConfigDto) {
    return this.aiBotService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all bot configurations (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated list of configs' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden – admin role required' })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.aiBotService.findAll(Number(page), Number(limit));
  }

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get active bot config for frontend' })
  @ApiQuery({ name: 'brandId', required: false, description: 'Brand ID context' })
  async getActive(@Query('brandId') brandId?: string) {
    return this.aiBotService.getActiveConfig(brandId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get details of a config' })
  findOne(@Param('id') id: string) {
    return this.aiBotService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @AuditTrail({ entityType: 'AiChatBotConfig', action: ChangeType.update })
  @ApiOperation({ summary: 'Update configuration' })
  update(@Param('id') id: string, @Body() dto: UpdateAiBotConfigDto) {
    return this.aiBotService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @AuditTrail({ entityType: 'AiChatBotConfig', action: ChangeType.delete })
  @ApiOperation({ summary: 'Delete configuration' })
  remove(@Param('id') id: string) {
    return this.aiBotService.remove(id);
  }
}
