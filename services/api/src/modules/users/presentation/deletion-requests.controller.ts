import { Controller, Get, Param, Patch, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ListDeletionRequestsHandler } from '../application/queries/handlers/list-deletion-requests.handler';
import { ReviewDeletionRequestHandler } from '../application/commands/handlers/review-deletion-request.handler';
import { ListDeletionRequestsQuery } from '../application/queries/list-deletion-requests.query';
import { ReviewDeletionRequestCommand } from '../application/commands/review-deletion-request.command';
import { DeletionRequestResponseDto, ReviewDeletionRequestDto } from './dto/deletion-request.dto';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../auth/application/decorators/roles.decorator';
import { UserRole } from '../../../core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('admin/deletion-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class DeletionRequestsController {
  constructor(
    private readonly listHandler: ListDeletionRequestsHandler,
    private readonly reviewHandler: ReviewDeletionRequestHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Deletion Requests (Admin)' })
  @ApiResponse({ status: 200, description: 'List of deletion requests' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const query = new ListDeletionRequestsQuery(status, page, limit);
    return this.listHandler.execute(query);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review Deletion Request (Admin)' })
  @ApiResponse({ status: 200, description: 'Request reviewed successfully', type: DeletionRequestResponseDto })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewDeletionRequestDto,
    @CurrentUser() admin: CurrentUserData
  ) {
    // We assume the user is an admin. In production, add @Roles('admin') check.
    const command = new ReviewDeletionRequestCommand(id, admin.userId, dto.action, dto.notes);
    return this.reviewHandler.execute(command);
  }
}
