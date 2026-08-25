// services/api/src/modules/programs/presentation/content-templates.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../application/commands/content-template.commands';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../application/queries/get-content-templates.query';
import { CreateContentTemplateDto, UpdateContentTemplateDto, ContentTemplateSummaryDto, ContentTemplateDetailDto } from './dto/content-template.dto';

@ApiTags('Content Templates')
@ApiBearerAuth()
@Controller('content-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ContentTemplatesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List content templates, optionally filtered by entityType.' })
  list(@Query('entityType') entityType?: string): Promise<ContentTemplateSummaryDto[]> {
    return this.queryBus.execute(new GetContentTemplatesQuery(entityType));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a content template with its full payload.' })
  detail(@Param('id') id: string): Promise<ContentTemplateDetailDto> {
    return this.queryBus.execute(new GetContentTemplateByIdQuery(id));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a content template by exporting a program's current content (super-admin only)." })
  create(@Body() dto: CreateContentTemplateDto) {
    return this.commandBus.execute(new CreateContentTemplateCommand(dto));
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Update a content template's name/description/isDefault (super-admin only). Payload is immutable after creation." })
  update(@Param('id') id: string, @Body() dto: UpdateContentTemplateDto) {
    return this.commandBus.execute(new UpdateContentTemplateCommand(id, dto));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a content template (super-admin only).' })
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteContentTemplateCommand(id));
  }
}
