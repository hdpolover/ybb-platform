// services/api/src/modules/programs/application/copy/copiers/program-details.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';

/**
 * The only scalar copier: it copies three columns on the Program row itself
 * (program.prisma:191-194) rather than a collection of child rows. There is
 * no id, no order, no dedupe key, and no soft-delete for a scalar — those
 * concepts don't apply here, so unlike copyScopedRows's callers this copier
 * talks to `tx.program` directly.
 */
type ProgramContentScalars = {
  requirementsDescription: string | null;
  benefitsDescription: string | null;
  termsAndConditions: string | null;
};

const SELECT = { requirementsDescription: true, benefitsDescription: true, termsAndConditions: true } as const;

function contentFieldCount(program: ProgramContentScalars): number {
  return [program.requirementsDescription, program.benefitsDescription, program.termsAndConditions].filter(Boolean).length;
}

@Injectable()
export class ProgramDetailsCopier implements ProgramCopier {
  readonly key = 'program-details';
  readonly label = 'Participant-Facing Content';

  // Appending to a scalar is meaningless — there's nothing to append to,
  // only something to overwrite. The frontend hides the mode toggle for
  // this copier; copy() below rejects append as a belt-and-suspenders check.
  readonly supportsAppend = false;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return 0;
    // The unit here is the section, not a field: "how many things would
    // copying produce" only has one possible non-zero answer (1) since all
    // three fields move together as a single Program.update. A program with
    // no content in any of the three fields has nothing to count.
    return contentFieldCount(program) > 0 ? 1 : 0;
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return [];
    const count = contentFieldCount(program);
    // An empty source (all three fields null/blank) previews as nothing to
    // copy, not as an item worth showing with "0 field(s) with content" —
    // that reads as broken, not as "there's an item here".
    if (count === 0) return [];
    return [
      {
        id: programId,
        label: 'Requirements, Benefits & Terms',
        meta: `${count} field(s) with content`,
      },
    ];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'program-details only supports replace mode.',
      });
    }

    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) {
      throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    }

    // Same data-loss shape every row-based copier guards against
    // (copy-scoped-rows.ts's `empty_replace_source`, mirrored again in
    // payments.copier.ts for its two-level case): a source with no content
    // in any of the three fields would overwrite the target's populated
    // text with three nulls, indistinguishable from wiping it outright with
    // nothing to show for the "replace". Refuse before any mutation.
    // A source with *some* content (even just one of three fields) is an
    // ordinary replace — including nulling out the other two on the
    // target — and proceeds normally.
    if (contentFieldCount(source) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
      });
    }

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: {
        requirementsDescription: source.requirementsDescription,
        benefitsDescription: source.benefitsDescription,
        termsAndConditions: source.termsAndConditions,
      },
    });

    // There is no per-row count for a scalar copy — created/skipped don't
    // apply (nothing is inserted, nothing is deduped). `replaced: 1` signals
    // "the program row's content section was overwritten" so the dialog
    // reads "1 replaced" rather than a 0 that looks like a no-op.
    return { created: 0, skipped: 0, replaced: 1 };
  }
}
