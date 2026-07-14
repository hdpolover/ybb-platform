// src/modules/participants/application/queries/handlers/validate-referral-code.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ValidateReferralCodeQuery } from '../validate-referral-code.query';
import { normalizeReferralCode } from '../../utils/referral-code.util';

@QueryHandler(ValidateReferralCodeQuery)
export class ValidateReferralCodeHandler implements IQueryHandler<ValidateReferralCodeQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: ValidateReferralCodeQuery): Promise<{ valid: true }> {
        const referralCode = normalizeReferralCode(query.code);
        if (!referralCode) {
            throw new BadRequestException('code is required');
        }

        const ambassador = await this.prisma.ambassador.findFirst({
            where: {
                referralCode,
                isActive: true,
                deletedAt: null,
            },
            // Unauthenticated endpoint — never select identifying fields.
            select: {
                id: true,
            },
        });

        if (!ambassador) {
            throw new NotFoundException('Referral code not found');
        }

        return { valid: true };
    }
}
