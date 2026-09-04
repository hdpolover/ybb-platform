import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DeletionStatus } from '@prisma/client';
import { CancelDeletionRequestCommand } from '../cancel-deletion-request.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { restoreAccountDeletionRequest } from '../../utils/account-deletion-restore.util';

type CancellationTokenSnapshot = {
    cancellationTokenHash?: string;
    cancellationTokenExpiresAt?: string;
};

// Same generic message for "no such request", "wrong/expired token" and a
// terminal-but-not-completed request (rejected). Distinguishing them buys an
// attacker guessing request ids nothing useful and only complicates the
// message list; the one case that DOES get its own message - 'completed' -
// is the one where plain refusal instead of a fake success matters (the
// account is gone, restoring is impossible, and saying so plainly is the
// explicit requirement here).
const INVALID_LINK_MESSAGE = 'This cancellation link is invalid or has expired. If you requested account deletion more than once, check your most recent email for the current link.';

// Machine-readable outcome codes. The cancel page has to render four visually
// distinct states, and classifying them by matching this file's prose would
// break silently the moment anyone reworded a message - the page would fall
// through to "invalid link" for an account that was actually already restored.
// Same contract the create handler already uses ({ code, message }).
export const DELETION_CANCEL_CODES = {
    restored: 'deletion_cancelled',
    alreadyCancelled: 'deletion_already_cancelled',
    alreadyDeleted: 'account_already_deleted',
    invalidLink: 'invalid_cancellation_link',
} as const;

const invalidLink = () =>
    new BadRequestException({ code: DELETION_CANCEL_CODES.invalidLink, message: INVALID_LINK_MESSAGE });

@Injectable()
export class CancelDeletionRequestHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) { }

    async execute(command: CancelDeletionRequestCommand): Promise<{ code: string; message: string }> {
        const request = await this.prisma.accountDeletionRequest.findUnique({
            where: { id: command.requestId },
        });

        if (!request) {
            throw invalidLink();
        }

        // Purge already ran: there is nothing left to restore. This must
        // refuse plainly, not appear to succeed - the account's PII is gone.
        if (request.status === DeletionStatus.completed) {
            throw new BadRequestException({
                code: DELETION_CANCEL_CODES.alreadyDeleted,
                message: 'This account has already been permanently deleted and cannot be restored.',
            });
        }

        // Idempotent: cancelling twice (e.g. a double click, or a retried
        // request) reports the same success instead of erroring.
        if (request.status === DeletionStatus.cancelled) {
            return {
                code: DELETION_CANCEL_CODES.alreadyCancelled,
                message: 'Your account deletion was already cancelled - your account is active.',
            };
        }

        if (request.status === DeletionStatus.rejected) {
            throw invalidLink();
        }

        // Only 'pending' (legacy) or 'approved' (the normal self-service
        // state) reach here - both are still restorable.
        const snapshot = (request.dataSnapshot ?? {}) as CancellationTokenSnapshot;
        const tokenHash = createHash('sha256').update(command.token).digest('hex');

        const tokenValid =
            !!snapshot.cancellationTokenHash &&
            snapshot.cancellationTokenHash === tokenHash &&
            !!snapshot.cancellationTokenExpiresAt &&
            new Date(snapshot.cancellationTokenExpiresAt) > new Date();

        if (!tokenValid) {
            throw invalidLink();
        }

        await this.prisma.$transaction((tx) => restoreAccountDeletionRequest(tx, request.id, request.userId));

        // Best-effort, outside the transaction - see create-deletion-request.handler.ts.
        const user = await this.prisma.user.findUnique({ where: { id: request.userId } });
        if (user) {
            const brand = await this.prisma.brand.findUnique({ where: { id: user.brandId } });
            const participant = await this.prisma.participant.findUnique({
                where: { userId: request.userId },
                select: { fullName: true },
            });
            await this.rabbitmqProducer.emit('user.account-deletion-cancelled', {
                email: user.email,
                name: participant?.fullName || user.email.split('@')[0],
                brand,
            });
        }

        return {
            code: DELETION_CANCEL_CODES.restored,
            message: 'Your account has been reactivated. Welcome back!',
        };
    }
}
