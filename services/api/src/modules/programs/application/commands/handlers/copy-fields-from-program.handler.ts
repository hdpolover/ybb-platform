import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyFieldsFromProgramCommand } from '../copy-fields-from-program.command';

type TxLike = PrismaService;

type CopyResult = {
  mode: 'append' | 'replace';
  sourceProgramId: string;
  added: string[];
  skipped: string[];
};

@Injectable()
@CommandHandler(CopyFieldsFromProgramCommand)
export class CopyFieldsFromProgramHandler
  implements ICommandHandler<CopyFieldsFromProgramCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    programId,
    sourceProgramId,
    fieldIds,
    mode,
  }: CopyFieldsFromProgramCommand): Promise<CopyResult> {
    if (sourceProgramId === programId) {
      throw new BadRequestException({
        code: 'invalid_source',
        message: 'Source program must differ from the target program.',
      });
    }

    return this.prisma.$transaction(async (tx: TxLike) => {
      let sourceFields = await tx.applicationFormField.findMany({
        where: { programId: sourceProgramId, deletedAt: null },
        orderBy: { order: 'asc' },
      });

      if (fieldIds && fieldIds.length > 0) {
        const idSet = new Set(fieldIds);
        sourceFields = sourceFields.filter((f: { id: string }) => idSet.has(f.id));
      }

      if (sourceFields.length === 0) {
        throw new BadRequestException({
          code: 'no_fields',
          message: 'No fields to copy from the source program.',
        });
      }

      if (mode === 'replace') {
        await tx.applicationFormField.updateMany({
          where: { programId, deletedAt: null },
          data: { deletedAt: new Date(), isActive: false },
        });
      }

      const existing =
        mode === 'append'
          ? await tx.applicationFormField.findMany({
              where: { programId, deletedAt: null },
              select: { name: true, order: true },
            })
          : [];
      const existingNames = new Set(
        existing.map((f: { name: string }) => f.name),
      );
      const baseOrder =
        mode === 'append'
          ? existing.reduce(
              (max: number, f: { order: number }) => Math.max(max, f.order),
              -1,
            ) + 1
          : 0;

      const added: string[] = [];
      const skipped: string[] = [];
      let placed = 0;

      for (const f of sourceFields) {
        if (existingNames.has(f.name)) {
          skipped.push(f.name);
          continue;
        }
        await tx.applicationFormField.create({
          data: {
            programId,
            name: f.name,
            label: f.label,
            type: f.type,
            section: f.section,
            isRequired: f.isRequired,
            order: baseOrder + placed,
            placeholder: f.placeholder,
            helpText: f.helpText,
            // Media and help assets are copied verbatim by design; when the source is a
            // different brand the admin UI shows a cross-brand caveat (see spec).
            mediaUrl: f.mediaUrl,
            mediaAlt: f.mediaAlt,
            helpAssets: (f.helpAssets as never) ?? [],
            options: (f.options as never) ?? [],
            validationRules: (f.validationRules as never) ?? {},
            source: f.source,
            systemFieldKey: f.systemFieldKey,
          },
        });
        added.push(f.name);
        existingNames.add(f.name);
        placed += 1;
      }

      return { mode, sourceProgramId, added, skipped };
    });
  }
}
