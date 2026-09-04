import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { DeletionStatus, PaymentStatus } from '@prisma/client';
import { CreateDeletionRequestCommand } from '../create-deletion-request.command';
import { DeletionRequestResponseDto } from '../../../presentation/dto/deletion-request.dto';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildAccountDeletionCancelUrl } from '../../utils/account-deletion-cancel-url.util';

// Product decision: a paid invoice or an in-flight application must NOT
// block deletion ("if they decide to delete their account, ignore their
// paid invoices and stuff - that's their decision"). "Ignore" means don't
// refuse - the invoice ledger itself is still retained untouched by the
// purge job regardless of this. The counts below are surfaced in the
// response instead, so the UI can warn before the user confirms.
const GRACE_PERIOD_DAYS = 30;

@Injectable()
export class CreateDeletionRequestHandler {
    constructor(
        @Inject(IAccountDeletionRequestRepository)
        private readonly repository: IAccountDeletionRequestRepository,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) { }

    async execute(command: CreateDeletionRequestCommand): Promise<DeletionRequestResponseDto> {
        const active = await this.repository.findActiveByUserId(command.userId);
        if (active) {
            throw new ConflictException('You already have a deletion request in progress.');
        }

        const [paidInvoiceCount, nonDraftApplicationCount] = await Promise.all([
            this.prisma.applicationInvoice.count({
                where: {
                    status: PaymentStatus.paid,
                    application: { participant: { userId: command.userId } },
                },
            }),
            this.prisma.participantApplication.count({
                where: {
                    participant: { userId: command.userId },
                    status: { not: ApplicationStatus.DRAFT },
                },
            }),
        ]);

        // No admin approval gate: a request immediately schedules the
        // deletion (status goes straight to 'approved', which is exactly
        // what the purge job's own query already looks for). Requiring an
        // admin to act before the 30-day clock starts is bad UX and sits
        // badly with erasure-request deadlines. Admins can still cancel it
        // (see ReviewDeletionRequestHandler's 'reject' action against an
        // 'approved' request) - nothing requires them to approve it first.
        const scheduledDeletionDate = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        // The account is deactivated immediately, which - via the
        // firebase-login.handler guard - means the user cannot log in to
        // change their mind. Reactivation therefore has to work without
        // logging in: an emailed, signed cancellation token. Only its HASH
        // is ever persisted (never the raw token, so a DB read alone can
        // never reactivate an account); it lives in the existing, otherwise
        // unused `dataSnapshot` JSON column rather than a new one, so this
        // needs no Prisma migration.
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');

        const created = await this.prisma.$transaction(async (tx) => {
            const request = await tx.accountDeletionRequest.create({
                data: {
                    userId: command.userId,
                    reason: command.dto.reason ?? null,
                    reasonCategory: command.dto.reasonCategory ?? null,
                    status: DeletionStatus.approved,
                    scheduledDeletionDate,
                    ipAddress: command.ipAddress ?? null,
                    userAgent: command.userAgent ?? null,
                    dataSnapshot: {
                        cancellationTokenHash: tokenHash,
                        cancellationTokenExpiresAt: scheduledDeletionDate.toISOString(),
                    },
                },
            });

            await tx.user.update({
                where: { id: command.userId },
                data: { isActive: false },
            });

            return request;
        });

        // Best-effort, outside the transaction, same as every other
        // notification emit in this codebase (forgot-password.handler.ts,
        // register.handler.ts) - a notification-bus hiccup must not undo an
        // already-committed deletion request.
        const user = await this.prisma.user.findUnique({ where: { id: command.userId } });
        const brand = user ? await this.prisma.brand.findUnique({ where: { id: user.brandId } }) : null;
        const participant = await this.prisma.participant.findUnique({
            where: { userId: command.userId },
            select: { fullName: true },
        });

        if (user) {
            await this.rabbitmqProducer.emit('user.account-deletion-requested', {
                email: user.email,
                name: participant?.fullName || user.email.split('@')[0],
                cancelUrl: buildAccountDeletionCancelUrl(this.configService, brand, created.id, rawToken),
                scheduledDeletionDate: scheduledDeletionDate.toISOString(),
                brand,
            });
        }

        return {
            id: created.id,
            userId: created.userId,
            status: created.status,
            reason: created.reason ?? undefined,
            reasonCategory: created.reasonCategory ?? undefined,
            createdAt: created.createdAt,
            scheduledDeletionDate: created.scheduledDeletionDate ?? undefined,
            consequences: {
                hasPaidInvoice: paidInvoiceCount > 0,
                paidInvoiceCount,
                hasNonDraftApplication: nonDraftApplicationCount > 0,
                nonDraftApplicationCount,
            },
        };
    }
}
