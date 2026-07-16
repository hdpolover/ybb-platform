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

        const programId = query.programId?.trim() || undefined;

        const ambassador = await this.prisma.ambassador.findFirst({
            where: {
                referralCode,
                isActive: true,
                deletedAt: null,
                // Ambassadors belong to one program; a code from another program is
                // not usable here. Only scope when the caller actually knows the
                // program — scoping to a guess would reject legitimate codes.
                ...(programId ? { programId } : {}),
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
