import { Injectable } from '@nestjs/common';
import { IAccountDeletionRequestRepository } from '@core/interfaces/repositories/account-deletion-request.repository.interface';
import { AccountDeletionRequest } from '@core/entities/account-deletion-request.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { DeletionStatus } from '@prisma/client';

@Injectable()
export class AccountDeletionRequestRepository implements IAccountDeletionRequestRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(req: AccountDeletionRequest): Promise<AccountDeletionRequest> {
        const created = await this.prisma.accountDeletionRequest.create({
            data: {
                userId: req.userId,
                reason: req.reason,
                reasonCategory: req.reasonCategory,
                status: req.status as DeletionStatus,
                ipAddress: req.ipAddress,
                userAgent: req.userAgent,
            },
        });
        return this.toDomain(created);
    }

    async findByUserId(userId: string): Promise<AccountDeletionRequest | null> {
        const req = await this.prisma.accountDeletionRequest.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return req ? this.toDomain(req) : null;
    }

    async findPendingByUserId(userId: string): Promise<AccountDeletionRequest | null> {
        const req = await this.prisma.accountDeletionRequest.findFirst({
            where: {
                userId,
                status: 'pending',
            },
        });
        return req ? this.toDomain(req) : null;
    }

    private toDomain(orm: any): AccountDeletionRequest {
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
            orm.dataSnapshot,
            orm.deletionLog,
            orm.ipAddress,
            orm.userAgent,
            orm.createdAt,
            orm.updatedAt,
        );
    }
}
