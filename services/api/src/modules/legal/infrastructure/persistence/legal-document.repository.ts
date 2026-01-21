import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LegalDocument } from '@prisma/client';
import { CreateLegalDocumentDto } from '../../presentation/dto/create-legal-document.dto';
import { UpdateLegalDocumentDto } from '../../presentation/dto/update-legal-document.dto';

@Injectable()
export class LegalDocumentRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByBrandSlug(brandSlug: string): Promise<LegalDocument[]> {
        return this.prisma.legalDocument.findMany({
            where: {
                programCategory: {
                    slug: brandSlug,
                },
                isActive: true, // Public only sees active
            },
            orderBy: {
                title: 'asc',
            },
        });
    }

    async findByBrandSlugAndType(brandSlug: string, slug: string): Promise<LegalDocument | null> {
        return this.prisma.legalDocument.findFirst({
            where: {
                programCategory: {
                    slug: brandSlug,
                },
                slug: slug,
                isActive: true,
            },
            orderBy: {
                version: 'desc', // Get latest version
            },
        });
    }

    async create(programCategoryId: string, data: CreateLegalDocumentDto): Promise<LegalDocument> {
        return this.prisma.legalDocument.create({
            data: {
                ...data,
                programCategoryId,
            },
        });
    }

    async update(id: string, data: UpdateLegalDocumentDto): Promise<LegalDocument> {
        return this.prisma.legalDocument.update({
            where: { id },
            data,
        });
    }

    async delete(id: string): Promise<LegalDocument> {
        return this.prisma.legalDocument.delete({
            where: { id },
        });
    }
    
    async findById(id: string): Promise<LegalDocument | null> {
        return this.prisma.legalDocument.findUnique({
            where: { id },
        });
    }
}
