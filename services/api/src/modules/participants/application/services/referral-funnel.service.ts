import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ReferralStatus } from '@prisma/client';

/**
 * ReferralFunnelService
 *
 * Application Layer - Domain Service
 * Advances an AmbassadorReferral through the conversion funnel stages and
 * maintains the ambassador's aggregate counters.
 *
 * Funnel: referred → registered → applied → accepted → completed
 *
 * All methods are fire-and-no-throw: failures are logged as warnings so that
 * they never break the primary operation that triggered them.
 */
@Injectable()
export class ReferralFunnelService {
    private readonly logger = new Logger(ReferralFunnelService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Call after a participant completes onboarding (profile filled).
     * Advances from `referred` → `registered`.
     */
    async advanceToRegistered(participantId: string): Promise<void> {
        try {
            const referral = await this.prisma.ambassadorReferral.findFirst({
                where: { participantId, status: ReferralStatus.referred },
            });

            if (!referral) return;

            const now = new Date();
            const daysToRegister = this.daysSince(referral.referredAt, now);

            await this.prisma.ambassadorReferral.update({
                where: { id: referral.id },
                data: {
                    status: ReferralStatus.registered,
                    registeredAt: now,
                    profileCompletedAt: now,
                    daysToRegister,
                },
            });

            this.logger.log(
                `Referral ${referral.id}: referred → registered (participant ${participantId})`,
            );
        } catch (e) {
            this.logger.warn(
                `advanceToRegistered failed for participant ${participantId}: ${e.message}`,
            );
        }
    }

    /**
     * Call after a participant submits an application.
     * Advances from `referred` or `registered` → `applied`.
     * Only triggers if the application belongs to the ambassador's program.
     */
    async advanceToApplied(participantId: string, programId: string): Promise<void> {
        try {
            const referral = await this.findReferralForProgram(participantId, programId);
            if (!referral) return;

            const advanceable: ReferralStatus[] = [
                ReferralStatus.referred,
                ReferralStatus.registered,
            ];
            if (!advanceable.includes(referral.status)) return;

            const now = new Date();
            const daysToApply = this.daysSince(referral.referredAt, now);

            await this.prisma.ambassadorReferral.update({
                where: { id: referral.id },
                data: {
                    status: ReferralStatus.applied,
                    appliedAt: now,
                    daysToApply,
                },
            });

            this.logger.log(
                `Referral ${referral.id}: → applied (participant ${participantId}, program ${programId})`,
            );
        } catch (e) {
            this.logger.warn(
                `advanceToApplied failed for participant ${participantId}: ${e.message}`,
            );
        }
    }

    /**
     * Call after an application is accepted.
     * Advances to `accepted` and increments the ambassador's successfulReferrals counter.
     * Only triggers if the application belongs to the ambassador's program.
     */
    async advanceToAccepted(participantId: string, programId: string): Promise<void> {
        try {
            const referral = await this.findReferralForProgram(participantId, programId);
            if (!referral) return;

            const terminal: ReferralStatus[] = [
                ReferralStatus.accepted,
                ReferralStatus.completed,
            ];
            if (terminal.includes(referral.status)) return;

            const now = new Date();
            const daysToAccept = this.daysSince(referral.referredAt, now);

            await this.prisma.$transaction(async (tx) => {
                await tx.ambassadorReferral.update({
                    where: { id: referral.id },
                    data: {
                        status: ReferralStatus.accepted,
                        acceptedAt: now,
                        daysToAccept,
                    },
                });

                const updated = await tx.ambassador.update({
                    where: { id: referral.ambassadorId },
                    data: { successfulReferrals: { increment: 1 } },
                });

                // Set firstSuccessfulReferralAt once, never overwrite
                if (!updated.firstSuccessfulReferralAt) {
                    await tx.ambassador.update({
                        where: { id: referral.ambassadorId },
                        data: { firstSuccessfulReferralAt: now },
                    });
                }
            });

            this.logger.log(
                `Referral ${referral.id}: → accepted (participant ${participantId}, program ${programId})`,
            );
        } catch (e) {
            this.logger.warn(
                `advanceToAccepted failed for participant ${participantId}: ${e.message}`,
            );
        }
    }

    /**
     * Call when a participant has paid ALL program fees (registration + program).
     * Advances to `completed`. Only triggers if both payment statuses are 'paid'
     * on the application and only for the ambassador's program.
     */
    async advanceToCompleted(participantId: string, programId: string): Promise<void> {
        try {
            // Verify both payment statuses are fully paid before advancing
            const application = await this.prisma.participantApplication.findFirst({
                where: {
                    participant: { id: participantId },
                    programId,
                    registrationPaymentStatus: 'paid',
                    programPaymentStatus: 'paid',
                },
                select: { id: true },
            });

            if (!application) return; // Not all payments done yet

            const referral = await this.findReferralForProgram(participantId, programId);
            if (!referral || referral.status === ReferralStatus.completed) return;

            const now = new Date();
            const totalConversionDays = this.daysSince(referral.referredAt, now);

            await this.prisma.ambassadorReferral.update({
                where: { id: referral.id },
                data: {
                    status: ReferralStatus.completed,
                    completedAt: now,
                    totalConversionDays,
                },
            });

            this.logger.log(
                `Referral ${referral.id}: → completed (participant ${participantId}, program ${programId})`,
            );
        } catch (e) {
            this.logger.warn(
                `advanceToCompleted failed for participant ${participantId}: ${e.message}`,
            );
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async findReferralForProgram(participantId: string, programId: string) {
        return this.prisma.ambassadorReferral.findFirst({
            where: {
                participantId,
                ambassador: { programId, isActive: true },
            },
        });
    }

    private daysSince(from: Date, to: Date): number {
        return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    }
}
