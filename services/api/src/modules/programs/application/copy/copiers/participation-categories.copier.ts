// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  order: number;
  isActive: boolean;
};

@Injectable()
export class ParticipationCategoriesCopier implements ProgramCopier {
  readonly key = 'participation-categories';
  readonly label = 'Participation Categories';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programParticipationCategory.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const categories = await this.prisma.programParticipationCategory.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (categories as unknown as CategoryRow[]).map((c) => ({
      id: c.id,
      label: c.name,
      meta: c.isActive ? 'Active' : 'Inactive',
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programParticipationCategory as unknown as ScopedRowsDelegate<CategoryRow>;
    return copyScopedRows<CategoryRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        name: row.name,
        description: row.description,
        benefits: row.benefits,
        eligibility: row.eligibility,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
      // Same guard reasoning as deleteParticipationCategory (Task 4) — a hard
      // dependency on ParticipantApplication.participationCategoryId with no
      // onDelete clause. Applied here to the bulk replace case: refuse to
      // soft-delete the target's current categories while any application
      // still references them, regardless of that application's status.
      beforeReplace: async (existingIds) => {
        if (existingIds.length === 0) return;
        const referencedCount = await tx.participantApplication.count({
          where: { participationCategoryId: { in: existingIds } },
        });
        if (referencedCount > 0) {
          throw new ConflictException({
            code: 'category_in_use',
            message: `Cannot replace: ${referencedCount} application(s) still reference the current participation categories. Use append mode instead, or reassign those applications first.`,
          });
        }
      },
    });
  }
}
