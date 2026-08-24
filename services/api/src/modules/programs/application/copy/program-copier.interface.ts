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
  // Set true only by copiers whose rows can carry cross-brand media: either
  // literal media references (form-fields' mediaUrl/helpAssets) or Tiptap
  // rich-text fields that can embed <img>/<iframe>/<video>
  // (program-details, participation-categories, payments' tier
  // description). Lets the generic dialog show the cross-brand warning
  // without knowing which entity it's rendering.
  hasExternalMedia?: boolean;
}

/**
 * The portable, storable form of "what a copier would copy" — produced by
 * exportTemplate, consumed by applyTemplate, and what ContentTemplate.payload
 * actually stores as JSON (Task 5). `items` is intentionally untyped at this
 * level: ProgramCopier is a function contract, not a data descriptor (spec),
 * so each copier's own exportTemplate/applyTemplate is the only code that
 * knows its own item shape — validated against template-payload.schemas.ts
 * (Task 4) inside each copier, not here.
 */
export interface TemplatePayload {
  entityType: string;
  payloadVersion: number;
  items: Record<string, unknown>[];
}

/**
 * Full spec ProgramCopier contract
 * (docs/superpowers/specs/2026-08-23-program-content-copy-design.md). Phase 1
 * shipped every member except exportTemplate/applyTemplate, deferred until
 * ContentTemplate existed. This plan (Phase 2) adds them.
 */
export interface ProgramCopier {
  readonly key: string;
  readonly label: string;
  readonly supportsAppend: boolean;

  countFor(programId: string): Promise<number>;
  preview(programId: string): Promise<CopyPreviewItem[]>;
  copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult>;

  /** Builds a storable payload from a program's current live rows. Honors itemIds like copy() does. */
  exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload>;
  /** Applies a stored payload into targetProgramId, sharing copy()'s dedupe/order/replace semantics. */
  applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult>;
}
