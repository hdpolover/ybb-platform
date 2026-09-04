import { Injectable } from '@nestjs/common';
import { Prisma, DeletionStatus } from '@prisma/client';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class AccountDeletionRequestRepository implements IAccountDeletionRequestRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string): Promise<AccountDeletionRequest | null> {
        const req = await this.prisma.accountDeletionRequest.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return req ? this.toDomain(req) : null;
    }

    async findActiveByUserId(userId: string): Promise<AccountDeletionRequest | null> {
        const req = await this.prisma.accountDeletionRequest.findFirst({
            where: {
                userId,
                status: { in: [DeletionStatus.pending, DeletionStatus.approved] },
            },
        });
        return req ? this.toDomain(req) : null;
    }

    private toDomain(orm: Prisma.AccountDeletionRequestGetPayload<Record<string, never>>): AccountDeletionRequest {
        return new AccountDeletionRequest(
            orm.id,
            orm.userId,
            orm.reason,
            orm.reasonCategory,
            orm.status,
            orm.reviewedBy,
            orm.reviewedAt,
            orm.reviewNotes,
            orm.scheduledDeletionDate,
            orm.actualDeletionDate,
            (orm.dataSnapshot ?? {}) as Record<string, unknown>,
            orm.deletionLog as Record<string, unknown>,
            orm.ipAddress,
            orm.userAgent,
            orm.createdAt,
            orm.updatedAt,
        );
    }
}
