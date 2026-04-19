import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ApplyFormTemplateCommand } from '../apply-form-template.command';

type TxLike = PrismaService;

type ApplyResult = {
  mode: 'append' | 'replace';
  templateId: string;
  added: string[];
  skipped: string[];
};

@Injectable()
@CommandHandler(ApplyFormTemplateCommand)
export class ApplyFormTemplateHandler
  implements ICommandHandler<ApplyFormTemplateCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({ programId, templateId, mode }: ApplyFormTemplateCommand): Promise<ApplyResult> {
    return this.prisma.$transaction(async (tx: TxLike) => {
      const template = await tx.applicationFormTemplate.findFirst({
        where: { id: templateId, deletedAt: null },
        include: { fields: { orderBy: { order: 'asc' } } },
      } as never);
      if (!template) {
        throw new NotFoundException(`Template ${templateId} not found`);
      }

      if (mode === 'replace') {
        await tx.applicationFormField.updateMany({
          where: { programId, deletedAt: null },
          data: { deletedAt: new Date(), isActive: false },
        });
      }

      const existing = mode === 'append'
        ? await tx.applicationFormField.findMany({
            where: { programId, deletedAt: null },
            select: { name: true },
          })
        : [];
      const existingNames = new Set(existing.map((f: { name: string }) => f.name));

      const added: string[] = [];
      const skipped: string[] = [];

      const templateFields = (template as any).fields as Array<{
        source: 'system' | 'custom';
        systemFieldKey: string | null;
        name: string | null;
        label: string | null;
        type: string | null;
        placeholder: string | null;
        helpText: string | null;
        options: unknown;
        validationRules: unknown;
        section: string;
        isRequired: boolean;
        order: number;
        labelOverride: string | null;
        helpTextOverride: string | null;
      }>;

      for (const tf of templateFields) {
        const computedName = tf.source === 'system' ? tf.systemFieldKey : tf.name;
        if (!computedName) {
          continue;
        }
        if (existingNames.has(computedName)) {
          skipped.push(computedName);
          continue;
        }

        let type = tf.type;
        let label = tf.labelOverride ?? tf.label;
        let options = tf.options;
        let helpText = tf.helpTextOverride ?? tf.helpText;

        if (tf.source === 'system' && tf.systemFieldKey) {
          const def = await tx.systemFormFieldDefinition.findUnique({
            where: { key: tf.systemFieldKey },
          });
          if (!def || !def.isActive || def.deletedAt) {
            skipped.push(computedName);
            continue;
          }
          type = def.type;
          if (!tf.labelOverride) label = def.label;
          if (!options || (Array.isArray(options) && (options as unknown[]).length === 0)) {
            options = def.defaultOptions;
          }
          if (!tf.helpTextOverride) helpText = def.helpText;
        }

        await tx.applicationFormField.create({
          data: {
            programId,
            name: computedName,
            label: label ?? computedName,
            type: type ?? 'text',
            section: tf.section,
            isRequired: tf.isRequired,
            order: tf.order,
            placeholder: tf.placeholder,
            helpText: helpText ?? null,
            options: (options as never) ?? [],
            validationRules: (tf.validationRules as never) ?? {},
            source: tf.source,
            systemFieldKey: tf.source === 'system' ? tf.systemFieldKey : null,
          },
        });
        added.push(computedName);
        existingNames.add(computedName);
      }

      return { mode, templateId, added, skipped };
    });
  }
}
