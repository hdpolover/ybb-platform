import { Controller, Get, Post, Delete, Body, Param, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { ApplicationCategory } from '@prisma/client';
import { CreateParticipationInfoDto, ParticipationInfoResponseDto } from './dto/participation-info.dto';
import { UpsertParticipationInfoCommand, DeleteParticipationInfoCommand } from '../application/commands/participation-info.commands';
import { GetParticipationInfoQuery, ListParticipationInfoQuery } from '../application/queries/participation-info.queries';
import { Public } from '@shared/decorators/public.decorator';

@ApiTags('Program Participation Info')
@Controller('programs/:programId/participation-info')
export class ProgramParticipationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert participation info for a category' })
  @ApiResponse({ status: 201, type: ParticipationInfoResponseDto })
  async upsert(
    @Param('programId') programId: string,
    @Body() dto: CreateParticipationInfoDto,
  ) {
    return this.commandBus.execute(new UpsertParticipationInfoCommand(programId, dto));
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all defined participation infos for a program' })
  @ApiResponse({ status: 200, type: [ParticipationInfoResponseDto] })
  async list(@Param('programId') programId: string) {
    return this.queryBus.execute(new ListParticipationInfoQuery(programId));
  }

  @Get(':category')
  @Public()
  @ApiOperation({ summary: 'Get specific participation info by category' })
  @ApiParam({ name: 'category', enum: ApplicationCategory })
  @ApiResponse({ status: 200, type: ParticipationInfoResponseDto })
  async get(
    @Param('programId') programId: string,
    @Param('category') category: ApplicationCategory,
  ) {
    const result = await this.queryBus.execute(new GetParticipationInfoQuery(programId, category));
    if (!result) throw new NotFoundException('Participation Info not found for this category');
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete participation info' })
  async delete(
    @Param('programId') programId: string,
    @Param('id') id: string,
  ) {
    return this.commandBus.execute(new DeleteParticipationInfoCommand(programId, id));
  }
}
