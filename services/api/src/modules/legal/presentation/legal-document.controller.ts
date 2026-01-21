import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { LegalDocumentService } from '../application/services/legal-document.service';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { LegalDocumentResponseDto } from './dto/legal-document-response.dto';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

@ApiTags('legal-documents')
@Controller('brands/:brandSlug/legal-documents')
export class LegalDocumentController {
    constructor(private readonly service: LegalDocumentService) {}

    @Get()
    @ApiOperation({ summary: 'List all active legal documents for a brand (Public)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand (e.g., ybb, iys)' })
    @ApiResponse({ status: 200, description: 'List of legal documents', type: [LegalDocumentResponseDto] })
    async list(@Param('brandSlug') brandSlug: string) {
        return this.service.findAllByBrand(brandSlug);
    }

    @Get(':typeSlug')
    @ApiOperation({ summary: 'Get a specific legal document by type/slug (Public)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiParam({ name: 'typeSlug', description: 'The slug of the document (e.g., privacy-policy, terms-of-service)' })
    @ApiResponse({ status: 200, description: 'The legal document', type: LegalDocumentResponseDto })
    @ApiNotFoundResponse({ description: 'Document not found' })
    async get(@Param('brandSlug') brandSlug: string, @Param('typeSlug') typeSlug: string) {
        return this.service.findOneByBrandAndType(brandSlug, typeSlug);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new legal document (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiResponse({ status: 201, description: 'Document created successfully', type: LegalDocumentResponseDto })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiNotFoundResponse({ description: 'Brand not found' })
    async create(
        @Param('brandSlug') brandSlug: string,
        @Body() dto: CreateLegalDocumentDto
    ) {
        return this.service.create(brandSlug, dto);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
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
        return this.service.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a legal document (Admin Only)' })
    @ApiParam({ name: 'brandSlug', description: 'The slug of the brand' })
    @ApiParam({ name: 'id', description: 'The ID of the document to delete' })
    @ApiResponse({ status: 200, description: 'Document deleted successfully' })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    async delete(@Param('brandSlug') brandSlug: string, @Param('id') id: string) {
        return this.service.delete(id);
    }
}
