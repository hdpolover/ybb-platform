import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { GetSystemFormFieldsQuery } from '../application/queries/get-system-form-fields.query';
import { SystemFormFieldDto } from './dto/system-form-field.dto';

@ApiTags('System Form Fields')
@ApiBearerAuth()
@Controller('system-form-fields')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SystemFormFieldsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'List system form field catalog entries' })
  list(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<SystemFormFieldDto[]> {
    return this.queryBus.execute(
      new GetSystemFormFieldsQuery(includeInactive === 'true'),
    );
  }
}
