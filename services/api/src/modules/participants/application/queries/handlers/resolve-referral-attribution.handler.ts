// src/modules/participants/application/queries/handlers/resolve-referral-attribution.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ResolveReferralAttributionQuery } from '../resolve-referral-attribution.query';
import { normalizeReferralCode } from '../../utils/referral-code.util';
import { ReferralAttributionDto } from '../../../presentation/dto/ambassador.dto';

@QueryHandler(ResolveReferralAttributionQuery)
export class ResolveReferralAttributionHandler implements IQueryHandler<ResolveReferralAttributionQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: ResolveReferralAttributionQuery): Promise<ReferralAttributionDto> {
        const referralCode = normalizeReferralCode(query.code);
        if (!referralCode) {
            return { valid: false, referredByName: null };
        }

        const programId = query.programId?.trim() || undefined;

        const ambassador = await this.prisma.ambassador.findFirst({
            where: {
                referralCode,
                isActive: true,
                deletedAt: null,
                // Ambassadors belong to one program; a code from another program is
                // not usable here. Only scope when the caller actually knows the
                // program — scoping to a guess would hide a legitimate attribution.
                ...(programId ? { programId } : {}),
            },
            // Authenticated endpoint (caller is the referred participant), so
            // selecting the ambassador's display name is safe here — unlike the
            // public validate endpoint, which never selects identifying fields.
            select: {
                fullName: true,
            },
        });

        if (!ambassador) {
            return { valid: false, referredByName: null };
        }

        return { valid: true, referredByName: ambassador.fullName };
    }
}
