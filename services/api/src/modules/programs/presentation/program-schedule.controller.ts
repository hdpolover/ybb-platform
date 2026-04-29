import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS as MUTABLE_CONTENT_CACHE_PATTERNS } from '@shared/constants/cache-patterns';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string };
}

import {
  ProgramTimelineResponseDto,
  ProgramScheduleResponseDto,
} from './dto/program-content.dto';

import {
  ListProgramTimelineQuery,
  ListProgramSchedulesQuery,
} from '../application/queries/list-program-content.queries';

import {
  ListProgramTimelineHandler,
  ListProgramSchedulesHandler,
} from '../application/queries/handlers/list-program-content.handlers';

import {
  CreateProgramTimelineDto, UpdateProgramTimelineDto,
  CreateProgramScheduleDto, UpdateProgramScheduleDto,
} from './dto/create-update-program-content.dto';

import {
  CreateProgramTimelineCommand, UpdateProgramTimelineCommand, DeleteProgramTimelineCommand,
  CreateProgramScheduleCommand, UpdateProgramScheduleCommand, DeleteProgramScheduleCommand,
} from '../application/commands/program-content.commands';

import {
  CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
  CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
} from '../application/commands/handlers/manage-program-content.handlers';

@ApiTags('Program Schedule')
@Controller('programs')
export class ProgramScheduleController {
  constructor(
    private readonly listProgramTimelineHandler: ListProgramTimelineHandler,
    private readonly listProgramSchedulesHandler: ListProgramSchedulesHandler,
    private readonly createProgramTimelineHandler: CreateProgramTimelineHandler,
    private readonly updateProgramTimelineHandler: UpdateProgramTimelineHandler,
    private readonly deleteProgramTimelineHandler: DeleteProgramTimelineHandler,
    private readonly createProgramScheduleHandler: CreateProgramScheduleHandler,
    private readonly updateProgramScheduleHandler: UpdateProgramScheduleHandler,
    private readonly deleteProgramScheduleHandler: DeleteProgramScheduleHandler,
  ) {}

  // --- Timeline Endpoints ---
  @Get(':id/timeline')
  @Public()
  @ApiOperation({ summary: 'Get program timeline' })
  @ApiResponse({ status: 200, type: [ProgramTimelineResponseDto] })
  async getTimeline(@Param('id') id: string): Promise<ProgramTimelineResponseDto[]> {
    return this.listProgramTimelineHandler.execute(new ListProgramTimelineQuery(id));
  }

  @Post(':id/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add timeline item' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addTimeline(@Param('id') programId: string, @Body() dto: CreateProgramTimelineDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramTimelineHandler.execute(new CreateProgramTimelineCommand(dto, req.user.id));
  }

  @Put('timeline/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update timeline item' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateTimeline(@Param('itemId') itemId: string, @Body() dto: UpdateProgramTimelineDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramTimelineHandler.execute(new UpdateProgramTimelineCommand(itemId, dto, req.user.id));
  }

  @Delete('timeline/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete timeline item' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteTimeline(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramTimelineHandler.execute(new DeleteProgramTimelineCommand(itemId, req.user.id));
  }

  // --- Schedule Endpoints ---
  @Get(':id/schedules')
  @Public()
  @ApiOperation({ summary: 'Get program schedules' })
  @ApiResponse({ status: 200, type: [ProgramScheduleResponseDto] })
  async getSchedules(@Param('id') id: string): Promise<ProgramScheduleResponseDto[]> {
    return this.listProgramSchedulesHandler.execute(new ListProgramSchedulesQuery(id));
  }

  @Post(':id/schedules')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add schedule item' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addSchedule(@Param('id') programId: string, @Body() dto: CreateProgramScheduleDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramScheduleHandler.execute(new CreateProgramScheduleCommand(dto, req.user.id));
  }

  @Put('schedules/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update schedule item' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateSchedule(@Param('itemId') itemId: string, @Body() dto: UpdateProgramScheduleDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramScheduleHandler.execute(new UpdateProgramScheduleCommand(itemId, dto, req.user.id));
  }

  @Delete('schedules/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete schedule item' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteSchedule(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramScheduleHandler.execute(new DeleteProgramScheduleCommand(itemId, req.user.id));
  }
}
