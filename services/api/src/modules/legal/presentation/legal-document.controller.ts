import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LegalDocumentService } from '../application/services/legal-document.service';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { LegalDocumentResponseDto } from './dto/legal-document-response.dto';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
// import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
// import { Roles } from '@modules/auth/infrastructure/decorators/roles.decorator';

@ApiTags('legal-documents')
@Controller('brands/:brandSlug/legal-documents')
export class LegalDocumentController {
    constructor(private readonly service: LegalDocumentService) {}

    @Get()
    @ApiOperation({ summary: 'List all legal documents for a brand' })
    @ApiResponse({ status: 200, type: [LegalDocumentResponseDto] })
    async list(@Param('brandSlug') brandSlug: string) {
        return this.service.findAllByBrand(brandSlug);
    }

    @Get(':typeSlug')
    @ApiOperation({ summary: 'Get a specific legal document by type/slug' })
    @ApiResponse({ status: 200, type: LegalDocumentResponseDto })
    async get(@Param('brandSlug') brandSlug: string, @Param('typeSlug') typeSlug: string) {
        return this.service.findOneByBrandAndType(brandSlug, typeSlug);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    // @Roles('admin', 'super_admin') // Uncomment if roles are implemented
    @ApiOperation({ summary: 'Create a new legal document (Admin)' })
    @ApiResponse({ status: 201, type: LegalDocumentResponseDto })
    async create(
        @Param('brandSlug') brandSlug: string,
        @Body() dto: CreateLegalDocumentDto
    ) {
        return this.service.create(brandSlug, dto);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    // @Roles('admin', 'super_admin')
    @ApiOperation({ summary: 'Update a legal document (Admin)' })
    @ApiResponse({ status: 200, type: LegalDocumentResponseDto })
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
    // @Roles('admin', 'super_admin')
    @ApiOperation({ summary: 'Delete a legal document (Admin)' })
    @ApiResponse({ status: 200, description: 'Deleted' })
    async delete(@Param('brandSlug') brandSlug: string, @Param('id') id: string) {
        return this.service.delete(id);
    }
}
