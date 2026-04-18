import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { EmailTemplate } from '@prisma/client';
import { CreateEmailTemplateDto } from '../../presentation/dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../../presentation/dto/update-email-template.dto';

export interface EmailTemplateFilter {
    brandId?: string;
    programId?: string;
    type?: string;
    isActive?: boolean;
}

@Injectable()
export class EmailTemplateRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(filter: EmailTemplateFilter = {}): Promise<EmailTemplate[]> {
        return this.prisma.emailTemplate.findMany({
            where: {
                ...(filter.brandId !== undefined ? { brandId: filter.brandId } : {}),
                ...(filter.programId !== undefined ? { programId: filter.programId } : {}),
                ...(filter.type ? { type: filter.type } : {}),
                ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
                deletedAt: null,
            },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
        });
    }

    async findById(id: string): Promise<EmailTemplate | null> {
        return this.prisma.emailTemplate.findFirst({
            where: { id, deletedAt: null },
        });
    }

    async create(data: CreateEmailTemplateDto): Promise<EmailTemplate> {
        return this.prisma.emailTemplate.create({
            data: {
                name: data.name,
                type: data.type,
                subject: data.subject,
                body: data.body,
                variables: data.variables ?? [],
                isActive: data.isActive ?? true,
                brandId: data.brandId ?? null,
                programId: data.programId ?? null,
            },
        });
    }

    async update(id: string, data: UpdateEmailTemplateDto): Promise<EmailTemplate> {
        return this.prisma.emailTemplate.update({
            where: { id },
            data,
        });
    }

    async delete(id: string): Promise<EmailTemplate> {
        return this.prisma.emailTemplate.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
    }
}
