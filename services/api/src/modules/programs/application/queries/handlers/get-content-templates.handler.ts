// services/api/src/modules/programs/application/queries/handlers/get-content-templates.handler.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../get-content-templates.query';
import { ContentTemplateSummaryDto, ContentTemplateDetailDto } from '../../../presentation/dto/content-template.dto';
import { TemplatePayload } from '../../copy/program-copier.interface';

function toSummary(row: {
  id: string; name: string; description: string | null; entityType: string; payload: unknown; isDefault: boolean; createdAt: Date; updatedAt: Date;
}): ContentTemplateSummaryDto {
  const payload = row.payload as unknown as TemplatePayload;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entityType,
    isDefault: row.isDefault,
    itemCount: payload.items.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
@QueryHandler(GetContentTemplatesQuery)
export class GetContentTemplatesHandler implements IQueryHandler<GetContentTemplatesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ entityType }: GetContentTemplatesQuery): Promise<ContentTemplateSummaryDto[]> {
    const rows = await this.prisma.contentTemplate.findMany({
      where: { deletedAt: null, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toSummary);
  }
}

@Injectable()
@QueryHandler(GetContentTemplateByIdQuery)
export class GetContentTemplateByIdHandler implements IQueryHandler<GetContentTemplateByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: GetContentTemplateByIdQuery): Promise<ContentTemplateDetailDto> {
    const row = await this.prisma.contentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException(`Content template ${id} not found`);
    return { ...toSummary(row), payload: row.payload as unknown as TemplatePayload };
  }
}
