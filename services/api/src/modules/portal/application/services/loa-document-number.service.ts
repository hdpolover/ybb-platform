import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { targetFieldsOf } from '@shared/utils/prisma-error.util';

export interface AssignOrGetResult {
  docNumber: string;
  isNew: boolean;
  existingDocId: string;
}

// Audit M62: a partial unique index on participant_documents.document_number is what
// would actually enforce uniqueness. It is NOT shipped yet - production already holds
// 144 colliding numbers across 288 issued documents, and renumbering an LOA someone may
// have filed with a visa application is a business decision, not a migration. So this
// retry path is inert today and becomes load-bearing the moment that index lands. True when `error` is the P2002 raised by that index, i.e. the computed
// docNumber for this attempt collided with a row already written (either a genuine
// concurrent first-call race on the same programme/count - the "Concurrency note"
// below - or, before the M62 programCode fix, a cross-programme collision). Any other
// P2002 (e.g. a future constraint on a different column) must propagate, not be
// silently retried.
function isDuplicateDocumentNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  return targetFieldsOf(error).includes('document_number');
}

// Bounds the retry loop below. A collision on attempt N means N other rows already
// hold that number for this programCode - past a handful of concurrent racers this
// stops being "the M59/M48-style single-race retry" and starts being a real anomaly
// worth surfacing as an error rather than looping.
const MAX_ASSIGN_ATTEMPTS = 5;

@Injectable()
export class LoaDocumentNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the stable LOA document number for an application, creating the
   * ParticipantDocument row on first call. Subsequent calls return the same number.
   * templateId must be the active LOA DocumentTemplate id so GetPortalDocumentsHandler
   * can match the row via d.templateId === tmpl.id (surfacing documentNumber) and
   * the uploaded-docs loop skips it (no double emission).
   *
   * Concurrency note: two simultaneous first-calls for the SAME application can each
   * pass the `existing` check above and both reach create() below - that produces two
   * ParticipantDocument rows for one application, not just a numbering gap. That risk
   * predates this fix and is intentionally left as-is (no unique constraint on
   * (applicationId, type) exists or is added here) - out of scope for M62, which is
   * about document NUMBER collisions, not row duplication.
   *
   * What IS handled here: the document_number itself colliding with another row,
   * caught by the partial unique index on participant_documents.document_number once
   * that index exists (see the note above the conflict predicate), and retried with a
   * bumped count, up to MAX_ASSIGN_ATTEMPTS.
   */
  async assignOrGet(
    applicationId: string,
    programId: string,
    programCode: string,
    templateId: string,
  ): Promise<AssignOrGetResult> {
    const existing = await this.prisma.participantDocument.findFirst({
      where: { applicationId, type: 'letter_of_acceptance' },
      select: { id: true, documentNumber: true },
    });

    if (existing?.documentNumber) {
      return { docNumber: existing.documentNumber, isNew: false, existingDocId: existing.id };
    }

    const baseCount = await this.prisma.participantDocument.count({
      where: {
        type: 'letter_of_acceptance',
        application: { programId },
      },
    });

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ASSIGN_ATTEMPTS; attempt++) {
      const padded = String(baseCount + 1 + attempt).padStart(4, '0');
      const docNumber = `LOA-${programCode}-${padded}`;

      try {
        const created = await this.prisma.participantDocument.create({
          data: {
            applicationId,
            templateId,         // required: lets GetPortalDocumentsHandler match by templateId
            type: 'letter_of_acceptance',
            name: 'Invitation Letter',
            documentNumber: docNumber,
            fileUrl: '',        // LOA is streamed on-demand; no stored file
            generatedAt: new Date(),
          },
          select: { id: true, documentNumber: true },
        });

        return { docNumber: created.documentNumber!, isNew: true, existingDocId: created.id };
      } catch (error) {
        if (!isDuplicateDocumentNumberConflict(error)) throw error;
        lastError = error;
        // Retry with the next padded number - see MAX_ASSIGN_ATTEMPTS.
      }
    }

    throw lastError;
  }
}
