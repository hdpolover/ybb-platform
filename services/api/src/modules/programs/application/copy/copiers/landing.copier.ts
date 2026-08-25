// services/api/src/modules/programs/application/copy/copiers/landing.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { isProgramLandingContentKey, PROGRAM_LANDING_CONTENT_KEYS } from '../program-landing-content.constants';
import { parseTemplateItems } from '../template-payload.schemas';

const SELECT = { landingContent: true } as const;

// landingContent's per-key shape is deliberately untyped (unknown) — see
// program-landing-content.constants.ts. "Has content" is checked
// structurally rather than by field-specific inspection: null/undefined is
// empty, an empty array or empty object is empty (mirrors the admin
// editor's own "cleared this section" state, e.g. groups: []), anything
// else counts.
//
// Recurses into objects/arrays rather than stopping at "has any keys at
// all": a section like `{ eyebrow: '', title: '', groups: [] }` has three
// keys but zero actual content — every value inside it is itself empty. A
// shallow `Object.keys(value).length > 0` check reads that shape as
// non-blank and would wave a visually-empty section through as real
// content (this mirrors ProgramDetailsCopier's isBlankRichText not
// stopping at "the string is non-empty" — it strips tags first). One
// nested field with real content (e.g. a non-empty title) is enough to
// count the whole section as populated.
function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => hasContent(item));
  if (typeof value === 'object') return Object.values(value as object).some((item) => hasContent(item));
  return Boolean(value);
}

function countPopulatedKeys(content: Record<string, unknown>): number {
  return PROGRAM_LANDING_CONTENT_KEYS.filter((key) => hasContent(content[key])).length;
}

// Belt-and-suspenders filter to the allow-list. The update handler (Task 5)
// already enforces this on every write that goes through it, but this
// copier reads landingContent straight off the row — defend against a stray
// key from any write path that didn't go through that handler (a raw
// backfill script, a future bug) propagating to the target.
function filterToAllowedKeys(content: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(content).filter(([key]) => isProgramLandingContentKey(key)));
}

@Injectable()
export class LandingCopier implements ProgramCopier {
  readonly key = 'landing';
  readonly label = 'Landing Page Content';

  // One JSON bucket on the Program row — nothing to append to, same
  // reasoning as ProgramDetailsCopier/ContactCopier.
  readonly supportsAppend = false;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return 0;
    const content = (program.landingContent as Record<string, unknown>) ?? {};
    return countPopulatedKeys(content) > 0 ? 1 : 0;
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return [];
    const content = (program.landingContent as Record<string, unknown>) ?? {};
    const count = countPopulatedKeys(content);
    if (count === 0) return [];
    return [
      {
        id: programId,
        label: 'Landing Page Sections',
        meta: `${count} section(s) with content`,
        // Always true when there's any content at all — landingContent's
        // per-key shape is intentionally untyped (unknown), so there is no
        // reliable field-name pattern to detect media the way
        // ProgramDetailsCopier detects <img>/<iframe>/<video> in known HTML
        // fields. Several keys (moments_shorts, benefits.groups[].imageUrl,
        // further_information.mockup_image_url) are known from the admin
        // editor sheets to carry literal media URLs. Over-warning here is
        // the safer failure mode than silently shipping another brand's
        // asset URLs with no notice.
        hasExternalMedia: true,
      },
    ];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'landing only supports replace mode.',
      });
    }

    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) {
      throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    }

    const sourceContent = (source.landingContent as Record<string, unknown>) ?? {};
    // Same data-loss guard every scalar copier in this feature carries: a
    // source with no populated keys would overwrite the target's landing
    // sections with an empty object, indistinguishable from wiping it.
    if (countPopulatedKeys(sourceContent) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          'The source program has no landing page content to copy. Add content to at least one section on the source program, then try again.',
      });
    }

    const target = await tx.program.findUnique({ where: { id: input.targetProgramId }, select: SELECT });
    const targetHadContent =
      target !== null && countPopulatedKeys((target.landingContent as Record<string, unknown>) ?? {}) > 0;

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: { landingContent: filterToAllowedKeys(sourceContent) as Prisma.InputJsonValue },
    });

    return { created: 1, skipped: 0, replaced: targetHadContent ? 1 : 0 };
  }

  async exportTemplate(programId: string): Promise<TemplatePayload> {
    // itemIds is not accepted — this copier has exactly one exportable unit
    // (the whole landingContent bucket), matching preview()'s single-item
    // shape.
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) {
      throw new NotFoundException(`Program ${programId} not found`);
    }
    const content = filterToAllowedKeys((program.landingContent as Record<string, unknown>) ?? {});
    return {
      entityType: this.key,
      payloadVersion: 1,
      items: [content],
    };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    if (mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'landing only supports replace mode.',
      });
    }

    const items = parseTemplateItems(this.key, payload.items) as unknown as Record<string, unknown>[];
    const item = items[0];

    // Same shape as copy()'s guard: a template with no populated keys would
    // overwrite the target's landing sections with an empty object. Reuses
    // countPopulatedKeys — no second emptiness notion. Refused before any
    // mutation.
    if (!item || countPopulatedKeys(item) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message: 'This template has no landing page content to apply.',
      });
    }

    await tx.program.update({
      where: { id: targetProgramId },
      data: { landingContent: filterToAllowedKeys(item) as Prisma.InputJsonValue },
    });

    // created: 1 on success, matching copy()'s semantics — see that
    // method's comment on the CopyResult contract for why.
    return { created: 1, skipped: 0, replaced: 0 };
  }
}
