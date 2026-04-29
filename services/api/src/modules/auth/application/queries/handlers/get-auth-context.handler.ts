import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAuthContextQuery } from '../get-auth-context.query';
import { AuthContextResponseDto } from '../../../presentation/dto/auth-context.dto';

/**
 * Resolves the auth context (brand + active program + local provider) needed by
 * the participant frontend to register/login a user. Centralizes the brand-by-domain
 * lookup so callers don't have to fetch /v1/brands and filter client-side
 * (which breaks once /v1/programs pagination caps out).
 */
@Injectable()
export class GetAuthContextHandler {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetAuthContextQuery): Promise<AuthContextResponseDto> {
        const brandDomain = (query.brandDomain ?? '').trim().toLowerCase();

        const providers = await this.prisma.authProvider.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                displayName: true,
                description: true,
                isOAuth: true,
                icon: true,
                buttonColor: true,
            },
            orderBy: { order: 'asc' },
        });

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

        const program = await this.prisma.program.findFirst({
            where: { brandId: brand.id, isPublished: true, isActive: true },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
            select: { id: true, slug: true },
        });

        return {
            brandDomain,
            brandId: brand.id,
            requireEmailVerification: brand.requireEmailVerification ?? true,
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
