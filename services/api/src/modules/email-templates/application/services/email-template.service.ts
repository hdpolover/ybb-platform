import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailTemplate } from '@prisma/client';
import { EmailTemplateRepository, EmailTemplateFilter } from '../../infrastructure/persistence/email-template.repository';
import { CreateEmailTemplateDto } from '../../presentation/dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../../presentation/dto/update-email-template.dto';

@Injectable()
export class EmailTemplateService {
    constructor(private readonly repository: EmailTemplateRepository) {}

    async findAll(filter: EmailTemplateFilter = {}): Promise<EmailTemplate[]> {
        return this.repository.findAll(filter);
    }

    async findById(id: string): Promise<EmailTemplate> {
        const template = await this.repository.findById(id);
        if (!template) throw new NotFoundException(`Email template with ID '${id}' not found`);
        return template;
    }

    async create(dto: CreateEmailTemplateDto): Promise<EmailTemplate> {
        await this.ensureUniqueTypeForScope(dto.type, {
            brandId: dto.brandId ?? null,
            programId: dto.programId ?? null,
        });
        return this.repository.create(dto);
    }

    async update(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
        const existing = await this.findById(id);
        const nextType = dto.type ?? existing.type;
        await this.ensureUniqueTypeForScope(
            nextType,
            {
                brandId: existing.brandId ?? null,
                programId: existing.programId ?? null,
            },
            id,
        );
        return this.repository.update(id, dto);
    }

    async delete(id: string): Promise<void> {
        await this.findById(id); // ensure exists
        await this.repository.delete(id);
    }

    async resolve(type: string, scope: { brandId?: string | null; programId?: string | null }): Promise<EmailTemplate | null> {
        return this.repository.resolveActiveTemplate(type, scope);
    }

    private async ensureUniqueTypeForScope(
        type: string,
        scope: { brandId?: string | null; programId?: string | null },
        excludeId?: string,
    ): Promise<void> {
        const existing = await this.repository.findByTypeAndScope(type, scope, excludeId);
        if (!existing) {
            return;
        }

        const scopeLabel = scope.programId
            ? 'program'
            : scope.brandId
                ? 'brand'
                : 'global';

        throw new ConflictException(
            `An email template for type '${type}' already exists at the ${scopeLabel} scope.`,
        );
    }
}
