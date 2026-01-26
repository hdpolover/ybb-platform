import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Query,
  Body,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { GetAmbassadorsListQuery, UpdateAmbassadorStatusCommand } from '../application/commands/ambassador-admin.commands';

@ApiTags('Ambassadors')
@Controller('admin/ambassadors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AmbassadorAdminController {
  constructor(
      private readonly queryBus: QueryBus,
      private readonly commandBus: CommandBus,
  ) {}

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
  @ApiOperation({ summary: 'Activate an ambassador' })
  async activate(@Param('id') id: string) {
      return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, true));
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an ambassador' })
  async deactivate(@Param('id') id: string) {
     return this.commandBus.execute(new UpdateAmbassadorStatusCommand(id, false));
  }
}
