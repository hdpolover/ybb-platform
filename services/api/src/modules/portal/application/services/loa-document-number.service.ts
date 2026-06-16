import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

export interface AssignOrGetResult {
  docNumber: string;
  isNew: boolean;
  existingDocId: string;
}

@Injectable()
export class LoaDocumentNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the stable LOA document number for an application, creating the
   * ParticipantDocument row on first call. Subsequent calls return the same number.
   * templateId must be the active LOA DocumentTemplate id so GetPortalDocumentsHandler
   * can match the row via d.templateId === tmpl.id (surfacing documentNumber) and
   * the uploaded-docs loop skips it (no double emission).
   * Concurrency note: two simultaneous first-calls can race on the count → minor
   * gap/duplicate risk; acceptable since document numbers need not be gapless.
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

    const count = await this.prisma.participantDocument.count({
      where: {
        type: 'letter_of_acceptance',
        application: { programId },
      },
    });

    const padded = String(count + 1).padStart(4, '0');
    const docNumber = `LOA-${programCode}-${padded}`;

    const created = await this.prisma.participantDocument.create({
      data: {
        applicationId,
        templateId,         // required: lets GetPortalDocumentsHandler match by templateId
        type: 'letter_of_acceptance',
        name: 'Letter of Acceptance',
        documentNumber: docNumber,
        fileUrl: '',        // LOA is streamed on-demand; no stored file
        generatedAt: new Date(),
      },
      select: { id: true, documentNumber: true },
    });

    return { docNumber: created.documentNumber!, isNew: true, existingDocId: created.id };
  }
}
