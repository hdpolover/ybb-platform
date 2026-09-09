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

        // Ambassadors now hold one code per brand, valid for every programme
        // in it — not one program each. So a supplied programId scopes to
        // that programme's BRAND, not to the programme itself; only scope at
        // all when the caller actually knows the program — scoping to a
        // guess would reject legitimate codes. An unresolvable programId
        // (unknown program) cannot be scoped to any brand, so it falls
        // through to the same "not found" outcome as a real cross-brand
        // mismatch below.
        let brandId: string | undefined;
        if (programId) {
            const program = await this.prisma.program.findUnique({
                where: { id: programId },
                select: { brandId: true },
            });
            brandId = program?.brandId;
            if (!brandId) {
                throw new NotFoundException('Referral code not found');
            }
        }

        const ambassador = await this.prisma.ambassador.findFirst({
            where: {
                referralCode,
                isActive: true,
                deletedAt: null,
                ...(brandId ? { user: { brandId } } : {}),
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
