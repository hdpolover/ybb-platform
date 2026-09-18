// services/api/src/modules/applications/application/commands/handlers/review-document.handler.ts
import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { ReviewDocumentCommand, DocumentReviewAction } from '../review-document.command';

const REVIEW_ACTION_STATUS: Record<DocumentReviewAction, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_revision: 'revision_requested',
};

const REVIEW_ACTION_EVENT: Record<DocumentReviewAction, string> = {
    approve: 'notification.document_approved',
    reject: 'notification.document_rejected',
    request_revision: 'notification.document_revision_requested',
};

export interface ReviewDocumentResult {
    id: string;
    submissionStatus: string;
    submissionNote: string | null;
    reviewedBy: string;
    reviewedAt: Date;
}

/**
 * Review Document Handler
 *
 * Application Layer - Command Handler
 *
 * Transitions a participant_documents row out of 'uploaded' into approved,
 * rejected, or revision_requested. Only 'uploaded' is reviewable: this is
 * what stops two admins racing on the same document (the guarded update
 * below only matches a row still in 'uploaded', so the loser gets a 409),
 * and what stops re-reviewing an already-decided document.
 */
@Injectable()
export class ReviewDocumentHandler {
    private readonly logger = new Logger(ReviewDocumentHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) {}

    async execute(command: ReviewDocumentCommand): Promise<ReviewDocumentResult> {
        const { applicationId, documentId, reviewerId, action, note } = command;

        if ((action === 'reject' || action === 'request_revision') && !note?.trim()) {
            throw new BadRequestException(`A note is required to ${action.replace('_', ' ')} a document.`);
        }

        const document = await this.prisma.participantDocument.findFirst({
            where: { id: documentId, applicationId, deletedAt: null },
            select: {
                id: true,
                name: true,
                submissionStatus: true,
                application: {
                    select: {
                        id: true,
                        programId: true,
                        program: { select: { name: true } },
                        participant: {
                            select: { fullName: true, userId: true, user: { select: { email: true } } },
                        },
                    },
                },
            },
        });

        if (!document) {
            throw new NotFoundException(`Document ${documentId} not found on application ${applicationId}`);
        }

        if (document.submissionStatus !== 'uploaded') {
            throw new ConflictException(
                `Document is in status '${document.submissionStatus}' and is not reviewable. Only an 'uploaded' document can be reviewed.`,
            );
        }

        const newStatus = REVIEW_ACTION_STATUS[action];
        const reviewedAt = new Date();
        const submissionNote = note?.trim() || null;

        // Compare-and-swap on submissionStatus: the WHERE clause re-checks
        // 'uploaded' at write time, so a second admin racing on the same
        // document (both passed the read-time check above) updates zero rows
        // instead of double-reviewing it.
        const { count } = await this.prisma.participantDocument.updateMany({
            where: { id: documentId, submissionStatus: 'uploaded' },
            data: {
                submissionStatus: newStatus,
                submissionNote,
                reviewedBy: reviewerId,
                reviewedAt,
            },
        });

        if (count === 0) {
            throw new ConflictException('Document was already reviewed by another admin.');
        }

        const userId = document.application.participant.userId;
        await this.cacheService.invalidatePortalCache(userId);

        await this.emitReviewNotification(action, document, submissionNote);

        return {
            id: document.id,
            submissionStatus: newStatus,
            submissionNote,
            reviewedBy: reviewerId,
            reviewedAt,
        };
    }

    /**
     * Best-effort emit of the outcome event. Runs after the review is already
     * committed, so a publish failure must never surface as a failure of the
     * review itself. No consumer exists yet (Phase 4 builds it); an unhandled
     * pattern is dropped by design (ack-drop-rmq.server.ts).
     */
    private async emitReviewNotification(
        action: DocumentReviewAction,
        document: {
            id: string;
            name: string;
            application: {
                id: string;
                program: { name: string };
                participant: { fullName: string; user: { email: string } };
            };
        },
        note: string | null,
    ): Promise<void> {
        try {
            await this.rabbitmqProducer.emit(REVIEW_ACTION_EVENT[action], {
                participant_name: document.application.participant.fullName,
                email: document.application.participant.user.email,
                program_name: document.application.program.name,
                document_name: document.name,
                application_id: document.application.id,
                document_id: document.id,
                outcome: REVIEW_ACTION_STATUS[action],
                note,
            });
        } catch (error) {
            this.logger.error(
                `[${REVIEW_ACTION_EVENT[action]}] failed to emit for document ${document.id}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
