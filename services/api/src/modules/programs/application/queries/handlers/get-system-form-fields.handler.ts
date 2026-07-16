import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetSystemFormFieldsQuery } from '../get-system-form-fields.query';
import { SystemFormFieldDto } from '../../../presentation/dto/system-form-field.dto';

@Injectable()
@QueryHandler(GetSystemFormFieldsQuery)
export class GetSystemFormFieldsHandler
  implements IQueryHandler<GetSystemFormFieldsQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetSystemFormFieldsQuery): Promise<SystemFormFieldDto[]> {
    const rows = await this.prisma.systemFormFieldDefinition.findMany({
      where: query.includeInactive
        ? { deletedAt: null }
        : { isActive: true, deletedAt: null },
      orderBy: [{ category: 'asc' }, { order: 'asc' }, { label: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      category: row.category,
      type: row.type,
      defaultOptions: (row.defaultOptions as unknown[]) ?? [],
      helpText: row.helpText,
      isMagic: row.isMagic,
      isActive: row.isActive,
      order: row.order,
    }));
  }
}
