import { Injectable, NotFoundException } from '@nestjs/common';
import { LegalDocumentRepository } from '../../infrastructure/persistence/legal-document.repository';
import { CreateLegalDocumentDto } from '../../presentation/dto/create-legal-document.dto';
import { UpdateLegalDocumentDto } from '../../presentation/dto/update-legal-document.dto';
import { LegalDocument } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class LegalDocumentService {
    constructor(
        private readonly repository: LegalDocumentRepository,
        private readonly prisma: PrismaService // For verifying brand existence
    ) {}

    async findAllByBrand(brandSlug: string): Promise<LegalDocument[]> {
        return this.repository.findByBrandSlug(brandSlug);
    }

    async findOneByBrandAndType(brandSlug: string, typeSlug: string): Promise<LegalDocument> {
        const doc = await this.repository.findByBrandSlugAndType(brandSlug, typeSlug);
        if (!doc) {
            throw new NotFoundException(`Legal document '${typeSlug}' not found for brand '${brandSlug}'`);
        }
        return doc;
    }

    async create(brandSlug: string, dto: CreateLegalDocumentDto): Promise<LegalDocument> {
        // Resolve brand ID
        const brand = await this.prisma.programCategory.findUnique({
            where: { slug: brandSlug },
        });

        if (!brand) {
            throw new NotFoundException(`Brand with slug '${brandSlug}' not found`);
        }

        return this.repository.create(brand.id, dto);
    }

    async update(id: string, dto: UpdateLegalDocumentDto): Promise<LegalDocument> {
        return this.repository.update(id, dto);
    }

    async delete(id: string): Promise<void> {
        await this.repository.delete(id);
    }
}
