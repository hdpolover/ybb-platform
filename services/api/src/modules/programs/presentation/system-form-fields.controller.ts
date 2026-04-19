import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { GetSystemFormFieldsQuery } from '../application/queries/get-system-form-fields.query';
import {
  CreateSystemFormFieldCommand,
  UpdateSystemFormFieldCommand,
  DeleteSystemFormFieldCommand,
} from '../application/commands/system-form-field.commands';
import { SystemFormFieldDto } from './dto/system-form-field.dto';
import {
  CreateSystemFormFieldDto,
  UpdateSystemFormFieldDto,
} from './dto/manage-system-form-field.dto';

@ApiTags('System Form Fields')
@ApiBearerAuth()
@Controller('system-form-fields')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SystemFormFieldsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List system form field catalog entries' })
  list(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<SystemFormFieldDto[]> {
    return this.queryBus.execute(
      new GetSystemFormFieldsQuery(includeInactive === 'true'),
    );
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a system form field (super-admin only)' })
  create(@Body() dto: CreateSystemFormFieldDto) {
    return this.commandBus.execute(new CreateSystemFormFieldCommand(dto));
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a system form field (super-admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSystemFormFieldDto,
  ) {
    return this.commandBus.execute(new UpdateSystemFormFieldCommand(id, dto));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Soft-delete a system form field (super-admin only)',
  })
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteSystemFormFieldCommand(id));
  }
}
