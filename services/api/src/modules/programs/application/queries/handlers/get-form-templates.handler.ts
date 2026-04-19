import { Injectable, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  GetFormTemplatesQuery,
  GetFormTemplateByIdQuery,
} from '../get-form-templates.query';
import {
  FormTemplateSummaryDto,
  FormTemplateDetailDto,
} from '../../../presentation/dto/form-template.dto';

@Injectable()
@QueryHandler(GetFormTemplatesQuery)
export class GetFormTemplatesHandler
  implements IQueryHandler<GetFormTemplatesQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(_: GetFormTemplatesQuery): Promise<FormTemplateSummaryDto[]> {
    const rows = await this.prisma.applicationFormTemplate.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { fields: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      isDefault: r.isDefault,
      fieldCount: r._count.fields,
      updatedAt: r.updatedAt,
    }));
  }
}

@Injectable()
@QueryHandler(GetFormTemplateByIdQuery)
export class GetFormTemplateByIdHandler
  implements IQueryHandler<GetFormTemplateByIdQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    id,
  }: GetFormTemplateByIdQuery): Promise<FormTemplateDetailDto> {
    const row = await this.prisma.applicationFormTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!row) throw new NotFoundException(`Template ${id} not found`);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      isDefault: row.isDefault,
      fields: row.fields.map((f: any) => ({
        id: f.id,
        source: f.source,
        systemFieldKey: f.systemFieldKey,
        name: f.name,
        label: f.label,
        type: f.type,
        section: f.section,
        isRequired: f.isRequired,
        order: f.order,
        labelOverride: f.labelOverride,
        helpTextOverride: f.helpTextOverride,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
