import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import {
  CreateFormTemplateCommand,
  UpdateFormTemplateCommand,
  DeleteFormTemplateCommand,
} from '../application/commands/form-template.commands';
import {
  GetFormTemplatesQuery,
  GetFormTemplateByIdQuery,
} from '../application/queries/get-form-templates.query';
import {
  CreateFormTemplateDto,
  UpdateFormTemplateDto,
  FormTemplateSummaryDto,
  FormTemplateDetailDto,
} from './dto/form-template.dto';

@ApiTags('Form Templates')
@ApiBearerAuth()
@Controller('form-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class FormTemplatesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List form templates' })
  list(): Promise<FormTemplateSummaryDto[]> {
    return this.queryBus.execute(new GetFormTemplatesQuery());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get form template detail (with fields)' })
  detail(@Param('id') id: string): Promise<FormTemplateDetailDto> {
    return this.queryBus.execute(new GetFormTemplateByIdQuery(id));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a form template (super-admin only)' })
  create(@Body() dto: CreateFormTemplateDto) {
    return this.commandBus.execute(new CreateFormTemplateCommand(dto));
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a form template (super-admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateFormTemplateDto) {
    return this.commandBus.execute(new UpdateFormTemplateCommand(id, dto));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a form template (super-admin only)' })
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteFormTemplateCommand(id));
  }
}
