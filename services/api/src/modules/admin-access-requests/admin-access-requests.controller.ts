// services/api/src/modules/admin-access-requests/admin-access-requests.controller.ts
import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeType } from '@prisma/client';
import { UserRole } from '@core/entities/user.entity';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { AdminScopeGuard, ScopedBy } from '@shared/guards/admin-scope.guard';
import { AccessRequestStatus, AdminAccessRequestsService } from './admin-access-requests.service';
import { ApproveAccessRequestDto } from './dto/approve-access-request.dto';
import { RejectAccessRequestDto } from './dto/reject-access-request.dto';
import { AdminAccessControlService } from '../admins/application/services/admin-access-control.service';

const STATUSES: AccessRequestStatus[] = ['pending', 'approved', 'rejected'];

@ApiTags('admin-access-requests')
@Controller('admin/access-requests')
@UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ScopedBy('platform')
@ApiBearerAuth()
export class AdminAccessRequestsController {
  constructor(
    private readonly service: AdminAccessRequestsService,
    private readonly access: AdminAccessControlService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List access requests (default: pending), newest first' })
  async list(@CurrentUser() currentUser: CurrentUserData, @Query('status') status: string = 'pending') {
    await this.access.assertCanManageAdmins(currentUser);
    if (!STATUSES.includes(status as AccessRequestStatus)) {
      throw new BadRequestException('status must be one of: pending, approved, rejected');
    }
    return this.service.list(status as AccessRequestStatus);
  }

  @Get('pending-count')
  @ApiOperation({ summary: 'Number of pending access requests' })
  async pendingCount(@CurrentUser() currentUser: CurrentUserData) {
    await this.access.assertCanManageAdmins(currentUser);
    return this.service.pendingCount();
  }

  @Post(':id/approve')
  @AuditTrail({ entityType: 'AdminAccessRequest', action: ChangeType.update })
  @ApiOperation({ summary: 'Approve: create the admin, assign programs, email a set-password link' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveAccessRequestDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.service.approve(currentUser, id, dto);
  }

  @Post(':id/reject')
  @AuditTrail({ entityType: 'AdminAccessRequest', action: ChangeType.update })
  @ApiOperation({ summary: 'Reject a pending request (no email)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAccessRequestDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.service.reject(currentUser, id, dto.reason);
  }
}
