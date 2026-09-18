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
    // touches.
    //
    // Nulls sort FIRST on purpose. They are the ~285 documents uploaded before
    // this column existed, i.e. the people who have been waiting longest with
    // no way to be reviewed at all. Sorting them last would put the entire
    // existing backlog behind every new upload, which is the opposite of what
    // this queue is for. They are ordered among themselves by generatedAt,
    // set once at row creation and equally immutable, so the fallback cannot
    // reshuffle either. `id` breaks any remaining tie.
    const [rows, total] = await Promise.all([
      this.prisma.participantDocument.findMany({
        where,
        orderBy: [
          { signedCopyUploadedAt: { sort: 'asc', nulls: 'first' } },
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
