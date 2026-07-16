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
                brand: {
                    slug: brandSlug,
                },
                isActive: true, // Public only sees active
                deletedAt: null,
            },
            orderBy: {
                title: 'asc',
            },
        });
    }

    async findByBrandSlugAndType(brandSlug: string, slug: string): Promise<LegalDocument | null> {
        return this.prisma.legalDocument.findFirst({
            where: {
                brand: {
                    slug: brandSlug,
                },
                slug: slug,
                isActive: true,
                deletedAt: null,
            },
            orderBy: {
                version: 'desc', // Get latest version
            },
        });
    }

    async findAllByBrandForAdmin(brandSlug: string, includeInactive = true): Promise<LegalDocument[]> {
        return this.prisma.legalDocument.findMany({
            where: {
                brand: { slug: brandSlug },
                deletedAt: null,
                ...(includeInactive ? {} : { isActive: true }),
            },
            orderBy: [{ slug: 'asc' }, { version: 'desc' }],
        });
    }

    async create(brandId: string, data: CreateLegalDocumentDto): Promise<LegalDocument> {
        return this.prisma.legalDocument.create({
            data: {
                ...data,
                brandId,
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
        return this.prisma.legalDocument.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false, // Also mark as inactive
            },
        });
    }
    
    async findById(id: string): Promise<LegalDocument | null> {
        return this.prisma.legalDocument.findFirst({
            where: { 
                id,
                deletedAt: null 
            },
        });
    }
}
