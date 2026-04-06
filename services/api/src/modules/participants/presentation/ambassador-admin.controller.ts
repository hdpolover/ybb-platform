import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Query,
  Body,
  Patch,
  Delete,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import {
  GetAmbassadorsListQuery,
  UpdateAmbassadorStatusCommand,
  GetAmbassadorReferralsQuery,
} from '../application/commands/ambassador-admin.commands';
import { DeleteAmbassadorCommand } from '../application/commands/delete-ambassador.command';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';

@ApiTags('Ambassadors')
@Controller('admin/ambassadors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AmbassadorAdminController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) { }

  @Get()
  @ApiOperation({ summary: 'List all ambassadors (Admin)' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  async findAll(
    @Query('programId') programId?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
  ) {
    return this.queryBus.execute(new GetAmbassadorsListQuery(programId, search, page));
  }

  @Patch(':id/activate')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Activate an ambassador' })
  async activate(@Param('id') id: string) {
    return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, true));
  }

  @Patch(':id/deactivate')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.update })
  @ApiOperation({ summary: 'Deactivate an ambassador' })
  async deactivate(@Param('id') id: string) {
    return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, false));
  }

  @Get(':id/referrals')
  @ApiOperation({ summary: 'List referrals for a specific ambassador (Admin)' })
  @ApiQuery({ name: 'page', required: false })
  async getReferrals(
    @Param('id') id: string,
    @Query('page') page: number = 1,
  ) {
    return this.queryBus.execute(new GetAmbassadorReferralsQuery(id, page));
  }

  @Delete(':id')
  @AuditTrail({ entityType: 'Ambassador', action: ChangeType.delete })
  @ApiOperation({ summary: 'Soft-delete an ambassador (Admin)' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const deletedBy: string = req.user?.id ?? req.user?.sub;
    return this.commandBus.execute(new DeleteAmbassadorCommand(id, deletedBy));
  }
}
