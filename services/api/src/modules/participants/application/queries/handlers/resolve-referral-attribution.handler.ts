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

        // Ambassadors now hold one code per brand, valid for every programme
        // in it — not one program each. So a supplied programId scopes to
        // that programme's BRAND, not to the programme itself; only scope at
        // all when the caller actually knows the program — scoping to a
        // guess would hide a legitimate attribution. An unresolvable
        // programId (unknown program) cannot be scoped to any brand, so it
        // falls through to the same valid:false outcome as a real
        // cross-brand mismatch below.
        let brandId: string | undefined;
        if (programId) {
            const program = await this.prisma.program.findUnique({
                where: { id: programId },
                select: { brandId: true },
            });
            brandId = program?.brandId;
            if (!brandId) {
                return { valid: false, referredByName: null };
            }
        }

        const ambassador = await this.prisma.ambassador.findFirst({
            where: {
                referralCode,
                isActive: true,
                deletedAt: null,
                ...(brandId ? { user: { brandId } } : {}),
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
