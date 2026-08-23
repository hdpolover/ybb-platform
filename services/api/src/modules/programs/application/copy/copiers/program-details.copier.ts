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

// The admin editor for these three fields is Tiptap (rich-text-editor.tsx),
// which emits HTML, not plain text. An admin who clears a field in the UI
// saves `<p></p>` (or `<p>&nbsp;</p>`), not `''` — update-program.dto.ts
// applies no trim/sanitiser before persistence, so that markup lands in the
// column verbatim. A raw `Boolean(value)` check reads `<p></p>` as "has
// content" and would wave a visually-empty field through as real content.
// Strip tags and collapse whitespace/nbsp before judging emptiness so
// "cleared in the editor" and "never set" are treated the same way.
//
// Tag-stripping alone over-corrects for a field whose only content is a
// visual element with no text inside it, e.g. `<img src="...">` or `<hr>` —
// stripping tags reduces either to `''`, which would misjudge a real,
// intentional field as blank. Those tags render something even with zero
// text, so their presence short-circuits straight to "not blank" before the
// strip-and-trim check ever runs.
const NON_BLANK_MEDIA_PATTERN = /<(img|iframe|video|hr)\b/i;

function isBlankRichText(value: string | null): boolean {
  if (!value) return true;
  if (NON_BLANK_MEDIA_PATTERN.test(value)) return false;
  const stripped = value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return stripped.length === 0;
}

function contentFieldCount(program: ProgramContentScalars): number {
  return [program.requirementsDescription, program.benefitsDescription, program.termsAndConditions].filter(
    (value) => !isBlankRichText(value),
  ).length;
}

// Subset of NON_BLANK_MEDIA_PATTERN that specifically embeds a `src`
// pointing at storage (hr has none, so it's excluded here even though it
// counts as non-blank content above). Cross-brand copies of these tags
// silently make the target brand's public page hotlink the source brand's
// storage — see CopyFromProgramDialog's cross-brand warning, which this
// flag drives.
const EXTERNAL_MEDIA_PATTERN = /<(img|iframe|video)\b/i;

function hasExternalMedia(program: ProgramContentScalars): boolean {
  return [program.requirementsDescription, program.benefitsDescription, program.termsAndConditions].some(
    (value) => value !== null && EXTERNAL_MEDIA_PATTERN.test(value),
  );
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
        hasExternalMedia: hasExternalMedia(program),
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
    // text with three blanks, indistinguishable from wiping it outright
    // with nothing to show for the "replace". Refuse before any mutation.
    // A source with *some* content (even just one of three fields) is an
    // ordinary replace — including blanking out the other two on the
    // target — and proceeds normally.
    if (contentFieldCount(source) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          "The source program has no content in Requirements, Benefits, or Terms & Conditions to copy. Add content to at least one of those fields on the source program, then try again.",
      });
    }

    // Read the target's current state before overwriting it, purely to
    // report an honest `replaced` count — this has no bearing on whether
    // the copy proceeds (unlike the source-side guard above, an
    // already-empty target is not a reason to refuse).
    const target = await tx.program.findUnique({ where: { id: input.targetProgramId }, select: SELECT });
    const targetHadContent = target !== null && contentFieldCount(target) > 0;

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: {
        requirementsDescription: source.requirementsDescription,
        benefitsDescription: source.benefitsDescription,
        termsAndConditions: source.termsAndConditions,
      },
    });

    // `created: 1` reports against the CopyResult contract every copier
    // shares (program-copier.interface.ts), not against any one caller's UI:
    // `created` means "how many top-level units, at the granularity
    // preview()/countFor() present, this call established at the target."
    // This copier has exactly one such unit — the whole three-field bundle
    // — and a successful replace always installs it, so `created` is
    // unconditionally 1 on success. (The shared CopyFromProgramDialog's
    // toast for this supportsAppend:false copier doesn't even read
    // `created`/`replaced` — it shows a plain "Replaced <label>." — but the
    // contract isn't scoped to what one caller happens to render with it.)
    // `replaced` additionally reports whether the target actually had prior
    // content overwritten, for callers that do inspect it.
    return { created: 1, skipped: 0, replaced: targetHadContent ? 1 : 0 };
  }
}
