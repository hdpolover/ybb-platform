import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { activeProgramQuery, openRegistrationProgramQuery } from '../../../../../shared/utils/active-program-resolver';
import { GetAuthContextQuery } from '../get-auth-context.query';
import { AuthContextResponseDto } from '../../../presentation/dto/auth-context.dto';
import { fetchActiveAuthProviders } from './active-auth-providers.util';

/**
 * Resolves the auth context (brand + active program + local provider) needed by
 * the participant frontend to register/login a user. Centralizes the brand-by-domain
 * lookup so callers don't have to fetch /v1/brands and filter client-side
 * (which breaks once /v1/programs pagination caps out).
 */
@Injectable()
export class GetAuthContextHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async execute(query: GetAuthContextQuery): Promise<AuthContextResponseDto> {
        const brandDomain = (query.brandDomain ?? '').trim().toLowerCase();

        const providers = await fetchActiveAuthProviders(this.prisma, this.cacheService);

        const localProviderId = providers.find(p => p.name === 'local')?.id ?? null;

        const brand = await this.resolveBrand(brandDomain);

        if (!brand) {
            return {
                brandDomain,
                brandId: null,
                requireEmailVerification: true,
                programId: null,
                programSlug: null,
                localProviderId,
                providers: providers.map(p => ({
                    ...p,
                    description: p.description || '',
                    icon: p.icon || '',
                    buttonColor: p.buttonColor || '',
                })),
            };
        }

        // Prefer the program actually taking registrations right now. Without
        // this, `year desc` alone sends every new registrant to a future
        // program the moment an admin publishes it — e.g. MEYS 2027 (opens
        // September) stealing MEYS 2026, which is open until December.
        // Deliberately NOT resolveActiveProgram(): its rule 2 fallback would
        // hand a program to brands that correctly resolve to null here.
        const select = { id: true, slug: true, requireEmailVerification: true };

        const program =
            (await this.prisma.program.findFirst({
                ...openRegistrationProgramQuery(brand.id, new Date()),
                select,
            })) ??
            // Rule 1 from the shared resolver rather than a copy of its where
            // clause: the copy missed the draft exclusion, so an unpublished
            // program could still surface here as the auth target.
            (await this.prisma.program.findFirst({
                ...activeProgramQuery(brand.id),
                select,
            }));

        // Program-level setting is authoritative when a program is found;
        // brand-level is the fallback. Read uncached — if a cache is added
        // later, invalidate on PUT /v1/brands/:id/settings and PUT /v1/programs/:id.
        const requireEmailVerification = program
            ? program.requireEmailVerification
            : (brand.requireEmailVerification ?? true);

        return {
            brandDomain,
            brandId: brand.id,
            requireEmailVerification,
            programId: program?.id ?? null,
            programSlug: program?.slug ?? null,
            localProviderId,
            providers: providers.map(p => ({
                ...p,
                description: p.description || '',
                icon: p.icon || '',
                buttonColor: p.buttonColor || '',
            })),
        };
    }

    private async resolveBrand(domain: string) {
        if (!domain) return null;

        // Mirror landing.service.resolveBrand: exact match → contains fallback.
        // isActive=true filter ensures we don't resolve to disabled brands.
        const exact = await this.prisma.brand.findFirst({
            where: { websiteUrl: domain, isActive: true },
            select: { id: true, requireEmailVerification: true },
        });
        if (exact) return exact;

        return this.prisma.brand.findFirst({
            where: {
                websiteUrl: { contains: domain, mode: 'insensitive' },
                isActive: true,
            },
            select: { id: true, requireEmailVerification: true },
        });
    }
}
