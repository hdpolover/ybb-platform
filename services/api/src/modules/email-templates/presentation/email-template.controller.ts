import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ChangeType, EmailTemplate } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import {
    assertBrandAccess,
    assertProgramAccess,
    getRequestAdminScope,
    orNotFound,
} from '@shared/guards/admin-scope.guard';
import { EmailTemplateService } from '../application/services/email-template.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { EmailTemplateResponseDto } from './dto/email-template-response.dto';

@ApiTags('Email Templates')
@Controller('admin/email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class EmailTemplateController {
    constructor(
        private readonly service: EmailTemplateService,
        private readonly readPrisma: PrismaReadService,
    ) {}

    /**
     * Throws unless the caller may act on a template owned by this brand/program.
     * A template with neither is global (the fallback for every brand) and so
     * platform-only. When both are set and the brand is not the program's own,
     * the brand needs its own grant - otherwise an admin of brand A could plant
     * a template under brand B by pairing it with one of A's programmes.
     */
    private async assertTemplateTarget(
        req: { user?: { adminId?: string } },
        target: { brandId?: string | null; programId?: string | null },
    ): Promise<void> {
        const scope = await getRequestAdminScope(this.readPrisma, req);
        if (scope.kind === 'platform') {
            return;
        }

        if (target.programId) {
            const program = await assertProgramAccess(this.readPrisma, scope, target.programId);
            if (!target.brandId || target.brandId === program.brandId) {
                return;
            }
        }

        if (!target.brandId) {
            throw new ForbiddenException('This action is restricted to platform administrators.');
        }

        assertBrandAccess(scope, target.brandId);
    }

    /** Loads the row from the same (primary) DB the write uses; out of scope reads as missing. */
    private async findScoped(req: { user?: { adminId?: string } }, id: string): Promise<EmailTemplate> {
        const template = await this.service.findById(id);
        await orNotFound(
            () => this.assertTemplateTarget(req, template),
            () => new NotFoundException(`Email template with ID '${id}' not found`),
        );
        return template;
    }

    private toDto(template: EmailTemplate): EmailTemplateResponseDto {
        const { deletedAt, ...rest } = template as EmailTemplate & { deletedAt?: Date | null };
        return rest;
    }

    @Get()
    @ApiOperation({ summary: 'List email templates' })
    @ApiQuery({ name: 'brandId', required: false, description: 'Filter by brand ID' })
    @ApiQuery({ name: 'programId', required: false, description: 'Filter by program ID' })
    @ApiQuery({ name: 'type', required: false, description: 'Filter by template type' })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
    @ApiResponse({ status: 200, description: 'List of email templates', type: [EmailTemplateResponseDto] })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async list(
        @Req() req: { user?: { adminId?: string } },
        @Query('brandId') brandId?: string,
        @Query('programId') programId?: string,
        @Query('type') type?: string,
        @Query('isActive') isActive?: string,
    ): Promise<EmailTemplateResponseDto[]> {
        await this.assertTemplateTarget(req, { brandId, programId });
        const filter = {
            ...(brandId ? { brandId } : {}),
            ...(programId ? { programId } : {}),
            ...(type ? { type } : {}),
            ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        };
        const templates = await this.service.findAll(filter);
        return templates.map(t => this.toDto(t));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get email template by ID' })
    @ApiParam({ name: 'id', description: 'Template UUID' })
    @ApiResponse({ status: 200, description: 'Email template detail', type: EmailTemplateResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiNotFoundResponse({ description: 'Template not found' })
    async getOne(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: { user?: { adminId?: string } },
    ): Promise<EmailTemplateResponseDto> {
        const template = await this.findScoped(req, id);
        return this.toDto(template);
    }

    @Post()
    @AuditTrail({ entityType: 'EmailTemplate', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a new email template' })
    @ApiResponse({ status: 201, description: 'Template created successfully', type: EmailTemplateResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async create(
        @Body() dto: CreateEmailTemplateDto,
        @Req() req: { user?: { adminId?: string } },
    ): Promise<EmailTemplateResponseDto> {
        await this.assertTemplateTarget(req, dto);
        const template = await this.service.create(dto);
        return this.toDto(template);
    }

    @Put(':id')
    @AuditTrail({ entityType: 'EmailTemplate', action: ChangeType.update })
    @ApiOperation({ summary: 'Update an email template' })
    @ApiParam({ name: 'id', description: 'Template UUID' })
    @ApiResponse({ status: 200, description: 'Template updated successfully', type: EmailTemplateResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiNotFoundResponse({ description: 'Template not found' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateEmailTemplateDto,
        @Req() req: { user?: { adminId?: string } },
    ): Promise<EmailTemplateResponseDto> {
        await this.findScoped(req, id);
        const template = await this.service.update(id, dto);
        return this.toDto(template);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @AuditTrail({ entityType: 'EmailTemplate', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete an email template (soft delete)' })
    @ApiParam({ name: 'id', description: 'Template UUID' })
    @ApiResponse({ status: 200, description: 'Template deleted successfully' })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiNotFoundResponse({ description: 'Template not found' })
    async delete(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: { user?: { adminId?: string } },
    ): Promise<{ message: string }> {
        await this.findScoped(req, id);
        await this.service.delete(id);
        return { message: 'Email template deleted successfully' };
    }
}
