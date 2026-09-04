import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { CreateDeletionRequestCommand } from '../create-deletion-request.command';
import { DeletionRequestResponseDto } from '../../../presentation/dto/deletion-request.dto';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Statuses that mean "there is an application actively in flight" - draft
// (nothing submitted yet) and the terminal rejected/withdrawn states are
// deliberately excluded. Blocking here is UX, not a data-integrity backstop:
// telling someone their deletion is impossible 30 days later, at purge time,
// is unacceptable, so this must be enforced before the request is even created.
const BLOCKING_APPLICATION_STATUSES = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.INTERVIEW_SCHEDULED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.WAITLISTED,
];

@Injectable()
export class CreateDeletionRequestHandler {
    constructor(
        @Inject(IAccountDeletionRequestRepository)
        private readonly repository: IAccountDeletionRequestRepository,
        private readonly prisma: PrismaService,
    ) { }

    async execute(command: CreateDeletionRequestCommand): Promise<DeletionRequestResponseDto> {
        const pending = await this.repository.findPendingByUserId(command.userId);
        if (pending) {
            throw new ConflictException('You already have a pending deletion request.');
        }

        const paidInvoice = await this.prisma.applicationInvoice.findFirst({
            where: {
                status: PaymentStatus.paid,
                application: { participant: { userId: command.userId } },
            },
            select: { id: true },
        });
        if (paidInvoice) {
            throw new ConflictException({
                code: 'paid_invoice_exists',
                message: 'You have a paid invoice on your account. Please contact support to request account deletion.',
            });
        }

        const inFlightApplication = await this.prisma.participantApplication.findFirst({
            where: {
                participant: { userId: command.userId },
                status: { in: BLOCKING_APPLICATION_STATUSES },
            },
            select: { id: true },
        });
        if (inFlightApplication) {
            throw new ConflictException({
                code: 'application_in_progress',
                message: 'You have an application currently in progress. Please withdraw it before requesting account deletion.',
            });
        }

        const request = new AccountDeletionRequest(
            '',
            command.userId,
            command.dto.reason ?? null,
            command.dto.reasonCategory ?? null,
            'pending',
            null, null, null, null, null, {}, {},
            command.ipAddress ?? null,
            command.userAgent ?? null,
            new Date(),
            new Date(),
        );

        const created = await this.repository.create(request);

        return {
            id: created.id,
            userId: created.userId,
            status: created.status,
            reason: created.reason ?? undefined,
            reasonCategory: created.reasonCategory ?? undefined,
            createdAt: created.createdAt,
        };
    }
}
