// services/api/src/modules/programs/application/copy/program-copier.interface.ts
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Mirrors TxLike in copy-fields-from-program.handler.ts — the callback
// argument of PrismaService.$transaction is typed as PrismaService itself
// throughout this codebase, not Prisma.TransactionClient.
export type PrismaTx = PrismaService;

export type CopyMode = 'append' | 'replace';

export interface CopyInput {
  sourceProgramId: string;
  targetProgramId: string;
  itemIds?: string[];
  mode: CopyMode;
  // Deliberately no `confirm` field: the type-REPLACE gate lives only at the
  // API boundary (ProgramCopyController), checked once before any copier
  // runs. See copy-fields-from-program.handler.ts, which never received
  // `confirm` either — program-form-fields.controller.ts drops it before
  // building the command.
}

export interface CopyResult {
  created: number;
  skipped: number;
  replaced: number;
}

export interface CopyPreviewItem {
  id: string;
  label: string;
  meta?: string;
  // Set true only by copiers whose rows can carry cross-brand media
  // (currently just form-fields). Lets the generic dialog show the
  // cross-brand warning without knowing which entity it's rendering.
  hasExternalMedia?: boolean;
}

/**
 * Phase 1 subset of the spec's full ProgramCopier contract
 * (docs/superpowers/specs/2026-08-23-program-content-copy-design.md). The
 * spec's interface also has exportTemplate/applyTemplate, added in Phase 2
 * once ContentTemplate exists. Every copier below implements only the six
 * members here — there is no stub for the template methods.
 */
export interface ProgramCopier {
  readonly key: string;
  readonly label: string;
  readonly supportsAppend: boolean;

  countFor(programId: string): Promise<number>;
  preview(programId: string): Promise<CopyPreviewItem[]>;
  copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult>;
}
