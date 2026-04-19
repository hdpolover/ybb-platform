import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  CreateFormTemplateCommand,
  UpdateFormTemplateCommand,
  DeleteFormTemplateCommand,
} from '../form-template.commands';
import { TemplateFieldInputDto } from '../../../presentation/dto/form-template.dto';
import { FIELD_KEY_FORMAT } from '../../validators/form-field-key.validator';
import { isMagicFormFieldKey } from '../../constants/magic-form-fields';

type TxLike = PrismaService;

async function validateAndResolveFields(
  tx: TxLike,
  fields: TemplateFieldInputDto[],
): Promise<void> {
  const seen = new Set<string>();
  for (const f of fields) {
    const name = resolveComputedName(f);
    if (!name) {
      throw new ConflictException({
        code: 'missing_field_name',
        message: `Template field requires a name (custom) or systemFieldKey (system).`,
      });
    }
    if (seen.has(name)) {
      throw new ConflictException({
        code: 'duplicate_field_key',
        message: `Template contains duplicate field key "${name}".`,
      });
    }
    seen.add(name);

    if (f.source === 'system') {
      if (!f.systemFieldKey) {
        throw new ConflictException({
          code: 'missing_system_field_key',
          message: 'system fields require a systemFieldKey.',
        });
      }
      const definition = await tx.systemFormFieldDefinition.findUnique({
        where: { key: f.systemFieldKey },
      });
      if (!definition || !definition.isActive || definition.deletedAt) {
        throw new ConflictException({
          code: 'unknown_system_field_key',
          message: `Unknown or inactive system field key: ${f.systemFieldKey}`,
        });
      }
    } else if (f.source === 'custom') {
      if (!f.name) {
        throw new ConflictException({
          code: 'missing_custom_name',
          message: 'custom fields require a name.',
        });
      }
      if (!FIELD_KEY_FORMAT.test(f.name)) {
        throw new ConflictException({
          code: 'invalid_format',
          message: `Field key "${f.name}" is invalid.`,
        });
      }
      if (isMagicFormFieldKey(f.name)) {
        throw new ConflictException({
          code: 'reserved_magic',
          message: `"${f.name}" is a reserved magic key.`,
        });
      }
      if (!f.type) {
        throw new ConflictException({
          code: 'missing_custom_type',
          message: 'custom fields require a type.',
        });
      }
      if (!f.label) {
        throw new ConflictException({
          code: 'missing_custom_label',
          message: 'custom fields require a label.',
        });
      }
    } else {
      throw new ConflictException({
        code: 'invalid_source',
        message: `Invalid field source: ${f.source}`,
      });
    }
  }
}

function resolveComputedName(f: TemplateFieldInputDto): string {
  if (f.source === 'system') return f.systemFieldKey ?? '';
  return f.name ?? '';
}

function mapFieldsToCreateRows(
  templateId: string,
  fields: TemplateFieldInputDto[],
) {
  return fields.map((f, idx) => ({
    templateId,
    source: f.source,
    systemFieldKey: f.source === 'system' ? f.systemFieldKey ?? null : null,
    name: f.source === 'custom' ? f.name ?? null : null,
    label: f.source === 'custom' ? f.label ?? null : null,
    type: f.source === 'custom' ? f.type ?? null : null,
    placeholder: f.placeholder ?? null,
    helpText: f.helpText ?? null,
    options: (f.options as never) ?? [],
    validationRules: (f.validationRules as never) ?? {},
    section: f.section ?? 'personal_details',
    isRequired: f.isRequired ?? false,
    order: f.order ?? idx,
    labelOverride: f.labelOverride ?? null,
    helpTextOverride: f.helpTextOverride ?? null,
  }));
}

@Injectable()
@CommandHandler(CreateFormTemplateCommand)
export class CreateFormTemplateHandler
  implements ICommandHandler<CreateFormTemplateCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ dto }: CreateFormTemplateCommand) {
    return this.prisma.$transaction(async (tx: TxLike) => {
      await validateAndResolveFields(tx, dto.fields);

      if (dto.isDefault && dto.category) {
        await tx.applicationFormTemplate.updateMany({
          where: { category: dto.category, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      const template = await tx.applicationFormTemplate.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          category: dto.category ?? null,
          isDefault: dto.isDefault ?? false,
        },
      });
      await tx.applicationFormTemplateField.createMany({
        data: mapFieldsToCreateRows(template.id, dto.fields),
      });
      return template;
    });
  }
}

@Injectable()
@CommandHandler(UpdateFormTemplateCommand)
export class UpdateFormTemplateHandler
  implements ICommandHandler<UpdateFormTemplateCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id, dto }: UpdateFormTemplateCommand) {
    return this.prisma.$transaction(async (tx: TxLike) => {
      const existing = await tx.applicationFormTemplate.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException(`Template ${id} not found`);

      if (dto.fields) {
        await validateAndResolveFields(tx, dto.fields);
      }

      const nextCategory = dto.category ?? existing.category;
      const nextIsDefault = dto.isDefault ?? existing.isDefault;
      if (nextIsDefault && nextCategory) {
        await tx.applicationFormTemplate.updateMany({
          where: {
            category: nextCategory,
            isDefault: true,
            deletedAt: null,
            NOT: { id },
          },
          data: { isDefault: false },
        });
      }

      const template = await tx.applicationFormTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });

      if (dto.fields) {
        await tx.applicationFormTemplateField.deleteMany({
          where: { templateId: id },
        });
        await tx.applicationFormTemplateField.createMany({
          data: mapFieldsToCreateRows(id, dto.fields),
        });
      }

      return template;
    });
  }
}

@Injectable()
@CommandHandler(DeleteFormTemplateCommand)
export class DeleteFormTemplateHandler
  implements ICommandHandler<DeleteFormTemplateCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: DeleteFormTemplateCommand) {
    const existing = await this.prisma.applicationFormTemplate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Template ${id} not found`);
    return this.prisma.applicationFormTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
