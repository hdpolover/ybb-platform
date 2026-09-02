// src/modules/reminders/presentation/participant-reminders.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { ParticipantReminderService } from '../application/services/participant-reminder.service';
import {
  CreateParticipantReminderDto,
  UpdateParticipantReminderDto,
} from '../application/dto/participant-reminder.dto';

/**
 * Every route here is admin-only (JWT + role guard) and no route that can cause
 * mail to be sent is a GET. Scheduling is a POST/PUT that writes a future send
 * time; the actual fan-out happens later, in-process, from
 * ParticipantReminderDispatchService's cron. There is deliberately no
 * "send now" endpoint — the whole point of the feature is that a human picked
 * the moment and could still change their mind.
 */
@ApiTags('Participant Reminders')
@Controller('programs')
export class ParticipantRemindersController {
  constructor(private readonly reminderService: ParticipantReminderService) {}

  @Get(':programId/reminders/audience')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Preview who would receive a registration-fee reminder: count plus a capped list',
  })
  async getAudience(@Param('programId') programId: string) {
    return this.reminderService.previewAudience(programId);
  }

  /**
   * POST, not GET, purely because the draft subject/body travel in the body —
   * it renders the tokens and returns text, and writes nothing.
   */
  @Post(':programId/reminders/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Render a draft subject/body against the first real recipient (sends nothing)',
  })
  async previewMessage(
    @Param('programId') programId: string,
    @Body() dto: CreateParticipantReminderDto,
  ) {
    return this.reminderService.previewMessage(programId, dto.subject, dto.body);
  }

  @Get(':programId/reminders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List participant reminders for a program' })
  async list(@Param('programId') programId: string) {
    return this.reminderService.list(programId);
  }

  @Get(':programId/reminders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'One reminder plus its per-recipient delivery log',
  })
  async get(@Param('programId') programId: string, @Param('id') reminderId: string) {
    return this.reminderService.get(programId, reminderId);
  }

  @Post(':programId/reminders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a reminder — a draft, or scheduled when scheduledAt is given',
  })
  async create(
    @Param('programId') programId: string,
    @Body() dto: CreateParticipantReminderDto,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.reminderService.create(programId, dto, req.user.id);
  }

  @Put(':programId/reminders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Edit a draft or still-scheduled reminder, or (re)set its send time',
  })
  async update(
    @Param('programId') programId: string,
    @Param('id') reminderId: string,
    @Body() dto: UpdateParticipantReminderDto,
  ) {
    return this.reminderService.update(programId, reminderId, dto);
  }

  @Post(':programId/reminders/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel a scheduled reminder before it sends (409 once it is sending)',
  })
  async cancel(@Param('programId') programId: string, @Param('id') reminderId: string) {
    return this.reminderService.cancel(programId, reminderId);
  }
}
