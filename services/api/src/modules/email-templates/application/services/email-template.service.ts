import { Injectable, NotFoundException } from '@nestjs/common';
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
        return this.repository.create(dto);
    }

    async update(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
        await this.findById(id); // ensure exists
        return this.repository.update(id, dto);
    }

    async delete(id: string): Promise<void> {
        await this.findById(id); // ensure exists
        await this.repository.delete(id);
    }
}
