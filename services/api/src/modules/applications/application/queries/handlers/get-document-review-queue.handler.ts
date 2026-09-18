// services/api/src/modules/applications/application/queries/handlers/get-document-review-queue.handler.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '@modules/files/application/private-file-url-resolver.service';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';
import { GetDocumentReviewQueueQuery } from '../get-document-review-queue.query';
import { DocumentReviewQueueResponseDto } from '../../dto/document-review-queue-response.dto';

@Injectable()
export class GetDocumentReviewQueueHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privateFileUrlResolver: PrivateFileUrlResolver,
  ) {}

  /**
   * Same fail-closed precedence GetPortalDocumentsHandler uses for the
   * participant side: a private-category file gets a fresh presigned url, a
   * failed presign omits the url rather than falling back to the raw stored
   * one, and anything else goes through the existing masked-download path.
   * Never build on the unauthenticated /v1/files/:fileId/download route.
   */
  private async resolveViewUrl(url: string | null): Promise<string | null> {
    if (!url) return null;
    const resolution = await this.privateFileUrlResolver.resolve(url);
    if (resolution === PRIVATE_FILE_UNAVAILABLE) return null;
    if (resolution) return resolution;
    return resolveMaskedFileUrl(this.prisma, url);
  }

  async execute(query: GetDocumentReviewQueueQuery): Promise<DocumentReviewQueueResponseDto> {
    const { programId, status, limit, offset } = query;

    const where = {
      type: 'agreement_letter',
      deletedAt: null,
      submissionStatus: status,
      application: { programId },
    } as const;

    // Never order by updatedAt (see plan): reviewing a row writes it, which
    // would reshuffle the queue under a reviewer mid-session. Order on
    // signedCopyUploadedAt instead, an upload-time stamp reviewing never
    // touches. Nulls (the 285 pre-existing rows, uploaded before this column
    // existed) sort last and are ordered among themselves by generatedAt,
    // which is set once at row creation and is equally immutable, so the
    // fallback cannot reshuffle either. `id` breaks any remaining tie.
    const [rows, total] = await Promise.all([
      this.prisma.participantDocument.findMany({
        where,
        orderBy: [
          { signedCopyUploadedAt: { sort: 'asc', nulls: 'last' } },
          { generatedAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit,
        skip: offset,
        select: {
          id: true,
          applicationId: true,
          name: true,
          submissionStatus: true,
          submissionNote: true,
          signedCopyUrl: true,
          signedCopyUploadedAt: true,
          generatedAt: true,
          reviewedBy: true,
          reviewedAt: true,
          reviewer: { select: { fullName: true } },
          application: {
            select: {
              program: { select: { name: true } },
              participant: {
                select: { fullName: true, user: { select: { email: true } } },
              },
            },
          },
        },
      }),
      this.prisma.participantDocument.count({ where }),
    ]);

    const items = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        applicationId: row.applicationId,
        documentName: row.name,
        submissionStatus: row.submissionStatus,
        submissionNote: row.submissionNote,
        signedCopyUrl: await this.resolveViewUrl(row.signedCopyUrl),
        signedCopyUploadedAt: row.signedCopyUploadedAt,
        generatedAt: row.generatedAt,
        reviewedBy: row.reviewedBy,
        reviewedByName: row.reviewer?.fullName ?? null,
        reviewedAt: row.reviewedAt,
        participantName: row.application.participant.fullName,
        participantEmail: row.application.participant.user?.email ?? null,
        programName: row.application.program.name,
      })),
    );

    return { items, total, limit, offset };
  }
}
