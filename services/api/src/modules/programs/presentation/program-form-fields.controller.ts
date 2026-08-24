import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { ApplyFormTemplateCommand } from '../application/commands/apply-form-template.command';
import { ApplyFormTemplateDto } from './dto/apply-form-template.dto';

@ApiTags('Program Form Fields')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ProgramFormFieldsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':programId/form-fields/apply-template')
  @ApiOperation({
    summary: "Apply a form template's fields to a program (append or replace).",
  })
  apply(
    @Param('programId') programId: string,
    @Body() dto: ApplyFormTemplateDto,
  ) {
    const mode = dto.mode ?? 'append';
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({
        code: 'confirm_required',
        message:
          "Replace mode requires 'confirm: true' in the request body.",
      });
    }
    return this.commandBus.execute(
      new ApplyFormTemplateCommand(programId, dto.templateId, mode),
    );
  }
}
