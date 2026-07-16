import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { LegalDocumentService } from '../application/services/legal-document.service';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { LegalDocumentResponseDto } from './dto/legal-document-response.dto';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { LegalDocument, ChangeType } from '@prisma/client';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { LANDING_BRAND_PATTERNS } from '@shared/constants/cache-patterns';

@ApiTags('Legal')
@Controller('brands/:brandSlug/legal-documents')
export class LegalDocumentController {
    constructor(private readonly service: LegalDocumentService) { }

    private toDto(doc: LegalDocument): LegalDocumentResponseDto {
        const { brandId, ...rest } = doc;
        return {
            ...rest,
            brandId: brandId,
        };
    }

    @Get()
    @ApiOperation({ summary: 'List all active legal documents for a brand (Public)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand (e.g., ybb, iys)' })
    @ApiResponse({ status: 200, description: 'List of legal documents', type: [LegalDocumentResponseDto] })
    async list(@Param('brandSlug') brandSlug: string) {
        const docs = await this.service.findAllByBrand(brandSlug);
        return docs.map(doc => this.toDto(doc));
    }

    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List all legal documents for a brand including inactive (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiResponse({ status: 200, description: 'All legal documents (including inactive)', type: [LegalDocumentResponseDto] })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async listAdmin(@Param('brandSlug') brandSlug: string) {
        const docs = await this.service.findAllByBrandForAdmin(brandSlug);
        return docs.map(doc => this.toDto(doc));
    }

    @Get('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get a legal document by ID (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiParam({ name: 'id', description: 'The UUID of the document' })
    @ApiResponse({ status: 200, description: 'The legal document', type: LegalDocumentResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiNotFoundResponse({ description: 'Document not found' })
    async getById(@Param('brandSlug') brandSlug: string, @Param('id') id: string) {
        const doc = await this.service.findById(id);
        return this.toDto(doc);
    }

    @Get(':typeSlug')
    @ApiOperation({ summary: 'Get a specific legal document by type/slug (Public)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiParam({ name: 'typeSlug', description: 'The slug of the document (e.g., privacy-policy, terms-of-service)' })
    @ApiResponse({ status: 200, description: 'The legal document', type: LegalDocumentResponseDto })
    @ApiNotFoundResponse({ description: 'Document not found' })
    async get(@Param('brandSlug') brandSlug: string, @Param('typeSlug') typeSlug: string) {
        const doc = await this.service.findOneByBrandAndType(brandSlug, typeSlug);
        return this.toDto(doc);
    }

    @Post()
    @CacheInvalidate(LANDING_BRAND_PATTERNS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'LegalDocument', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a new legal document (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiResponse({ status: 201, description: 'Document created successfully', type: LegalDocumentResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiNotFoundResponse({ description: 'Brand not found' })
    async create(
        @Param('brandSlug') brandSlug: string,
        @Body() dto: CreateLegalDocumentDto
    ) {
        const doc = await this.service.create(brandSlug, dto);
        return this.toDto(doc);
    }

    @Put(':id')
    @CacheInvalidate(LANDING_BRAND_PATTERNS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'LegalDocument', action: ChangeType.update })
    @ApiOperation({ summary: 'Update a legal document (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiParam({ name: 'id', description: 'The ID of the document to update' })
    @ApiResponse({ status: 200, description: 'Document updated successfully', type: LegalDocumentResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async update(
        @Param('brandSlug') brandSlug: string,
        @Param('id') id: string,
        @Body() dto: UpdateLegalDocumentDto
    ) {
        const doc = await this.service.update(id, dto);
        return this.toDto(doc);
    }

    @Delete(':id')
    @CacheInvalidate(LANDING_BRAND_PATTERNS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'LegalDocument', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete a legal document (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiParam({ name: 'id', description: 'The ID of the document to delete' })
    @ApiResponse({ status: 200, description: 'Document deleted successfully' })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async delete(@Param('brandSlug') brandSlug: string, @Param('id') id: string) {
        return this.service.delete(id);
    }
}
