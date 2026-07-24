import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Literal shown whenever preview has no already-assigned document number to
// reuse. Never allocated or persisted - preview must not burn real document
// numbers or bump download counters.
export const PREVIEW_DOCUMENT_NUMBER = 'PREVIEW/000';

export type ResolvedPreviewParticipant =
  | { isSample: true }
  | { isSample: false; applicationId: string };

/**
 * Resolves who an admin's LOA template preview should render as, and what
 * document number to show, without ever touching LoaDocumentNumberService
 * (which mints and persists real numbers) or LoaEligibilityService (which
 * additionally requires a released batch - deliberately not applied here,
 * since admins author templates before releasing).
 */
@Injectable()
export class LoaPreviewParticipantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `applicationId` explicit: validated against this program, 404 if it
   * doesn't belong here. Never silently falls back to auto-pick - a silent
   * fallback would let an admin believe they verified a specific
   * participant's letter when they did not.
   *
   * `applicationId` omitted: auto-picks the first application in the pool
   * of `submitted`/`accepted` applications for this program, explicitly NOT
   * gated on LoA eligibility (which additionally requires a released batch).
   * Falls back to `{ isSample: true }` only when that pool is empty.
   */
  async resolveApplicationId(programId: string, applicationId?: string): Promise<ResolvedPreviewParticipant> {
    if (applicationId) {
      const application = await this.prisma.participantApplication.findFirst({
        where: { id: applicationId, programId },
        select: { id: true },
      });
      if (!application) {
        throw new NotFoundException('Application not found for this program');
      }
      return { isSample: false, applicationId: application.id };
    }

    // `id: 'asc'` tiebreak is load-bearing, not cosmetic: the DRAFT and SAVED
    // preview panes each run this query independently (see
    // PreviewLoaTemplateHandler / LoaTemplateEditor.tsx generatePreview). With
    // `submittedAt` alone, a tie (bulk backfill, or both null) leaves row
    // order unspecified between the two calls, so the two panes could render
    // two different participants side by side. `id` is unique and stable, so
    // both calls resolve to the identical row given the same DB snapshot.
    const autoPicked = await this.prisma.participantApplication.findFirst({
      where: { programId, status: { in: ['submitted', 'accepted'] } },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (!autoPicked) {
      return { isSample: true };
    }
    return { isSample: false, applicationId: autoPicked.id };
  }

  /**
   * Uses the already-assigned document number when this application has
   * one (matching exactly what a real download would show), otherwise the
   * literal PREVIEW/000. Never calls LoaDocumentNumberService.assignOrGet -
   * this method only ever reads.
   */
  async resolveDocumentNumber(applicationId: string): Promise<string> {
    const existing = await this.prisma.participantDocument.findFirst({
      where: { applicationId, type: 'letter_of_acceptance' },
      select: { documentNumber: true },
    });
    if (existing?.documentNumber) return existing.documentNumber;
    return PREVIEW_DOCUMENT_NUMBER;
  }
}
