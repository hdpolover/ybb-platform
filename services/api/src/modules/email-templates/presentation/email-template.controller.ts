import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { ChangeType, EmailTemplate } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { EmailTemplateService } from '../application/services/email-template.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { EmailTemplateResponseDto } from './dto/email-template-response.dto';

@ApiTags('Email Templates')
@Controller('admin/email-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailTemplateController {
    constructor(private readonly service: EmailTemplateService) {}

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
        @Query('brandId') brandId?: string,
        @Query('programId') programId?: string,
        @Query('type') type?: string,
        @Query('isActive') isActive?: string,
    ): Promise<EmailTemplateResponseDto[]> {
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
    async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmailTemplateResponseDto> {
        const template = await this.service.findById(id);
        return this.toDto(template);
    }

    @Post()
    @AuditTrail({ entityType: 'EmailTemplate', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a new email template' })
    @ApiResponse({ status: 201, description: 'Template created successfully', type: EmailTemplateResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async create(@Body() dto: CreateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
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
    ): Promise<EmailTemplateResponseDto> {
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
    async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
        await this.service.delete(id);
        return { message: 'Email template deleted successfully' };
    }
}
