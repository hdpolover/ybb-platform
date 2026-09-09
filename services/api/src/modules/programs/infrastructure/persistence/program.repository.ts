import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IProgramRepository, FindAllProgramsParams, FindAllProgramsResult } from '@core/interfaces/repositories/program.repository.interface';
import { Program } from '@core/entities/program.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

@Injectable()
export class ProgramRepository implements IProgramRepository {
    private readonly logger = new Logger(ProgramRepository.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async findAll(params: FindAllProgramsParams): Promise<FindAllProgramsResult> {
        const { brandId, url, year, isPublished, isActive, isVisibleToUsers, status, page = 1, limit = 10, isAdmin } = params;

        const where: Prisma.ProgramWhereInput = {
            brandId,
            deletedAt: null,
        };

        if (url) {
            // Audit M34: this used to be an unindexed `brand: { OR: [websiteUrl
            // equals, websiteUrl ILIKE %url% ] }` join filter, evaluated twice per
            // request (count() + findMany() both apply `where`). Resolved once
            // here instead, through a cached id lookup (audit M34), so a repeat
            // host within the TTL costs zero brand queries instead of two.
            //
            // NOT reusing LandingService.resolveBrand(): it throws NotFoundException
            // on no match (this endpoint must return an empty page instead), and
            // it falls back to the platform's default active brand when `url` is
            // falsy (this endpoint must apply no brand filter at all in that case,
            // matching the original `if (url)` guard). Both would change this
            // public endpoint's response contract, so this mirrors resolveBrand's
            // cache pattern (same CacheService, same ~5min CACHE_TTL.MEDIUM, same
            // exact-then-contains resolution) as its own helper instead.
            const resolvedBrandId = await this.resolveBrandIdByUrl(url);
            if (!resolvedBrandId || (brandId && brandId !== resolvedBrandId)) {
                return { programs: [], total: 0 };
            }
            where.brandId = resolvedBrandId;
        }

        if (year !== undefined) {
            where.year = year;
        }

        // Audit M13: a non-admin caller (anonymous, or authenticated without an
        // admin role) must never be able to list draft/unpublished/hidden programs
        // by passing isPublished=false / isActive=false / isVisibleToUsers=false /
        // status=draft. Their filters on these fields are ignored, not validated —
        // an anonymous caller asking for drafts just gets published programs back,
        // the same as asking for nothing at all. Admin callers keep full control,
        // which the admin dashboard's programs list depends on (it requests drafts).
        if (isAdmin) {
            if (isPublished !== undefined) {
                where.isPublished = isPublished;
            }

            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            if (status !== undefined) {
                where.status = status;
            }

            if (isVisibleToUsers !== undefined) {
                where.isVisibleToUsers = isVisibleToUsers;
            }
        } else {
            where.isPublished = true;
            where.isVisibleToUsers = true;
        }

        const skip = (page - 1) * limit;

        const [total, programs] = await Promise.all([
            this.prisma.program.count({ where }),
            this.prisma.program.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { year: 'desc' },
                    { createdAt: 'desc' },
                ],
                include: {
                    brand: {
                        select: {
                            name: true,
                        },
                    },
                },
            }),
        ]);

        return {
            programs: programs.map(this.mapToEntity),
            total,
        };
    }

    async findById(id: string): Promise<Program | null> {
        const program = await this.prisma.program.findUnique({
            where: { id },
        });
        return program ? this.mapToEntity(program) : null;
    }

    /**
     * `Program` only has `@@unique([brandId, slug])` - there is no global-unique
     * constraint on `slug` alone, and two different brands can legitimately
     * have programs sharing a slug.
     *
     * NOTE on deletedAt: PrismaService's global `$extends` block already
     * auto-injects `deletedAt: null` into every `findUnique`/`findFirst` call
     * for any model with a `deletedAt` column (Program has one) - both
     * branches below get this for free. Do NOT add an explicit
     * `deletedAt: null` here; it would be redundant with the global
     * extension that every other repository in this codebase already relies
     * on.
     *
     * When brandId IS provided, the compound-key findUnique below is already
     * correctly brand-scoped.
     *
     * When brandId is NOT provided (every current caller: see
     * list-program-content.handlers.ts, manage-program-content.handlers.ts,
     * loa-batch.handlers.ts, loa-preview.handler.ts,
     * program-application.controller.ts - none thread brandId through today),
     * a bare `findFirst({ where: { slug } })` would silently return whichever
     * of two brands' colliding-slug programs the database happens to return
     * first - non-deterministic, and it never surfaces the ambiguity. This
     * deliberately refuses to guess instead: fetch at most 2 matches: 0 ->
     * null (unchanged), exactly 1 -> return it (unchanged for the
     * overwhelmingly common non-colliding case), 2+ -> log a warning and
     * return null rather than arbitrarily resolving to an arbitrary brand's
     * data. Callers that need disambiguation must pass brandId, which this
     * interface already supports - a future reader should NOT "fix" this
     * back to findFirst.
     */
    async findBySlug(slug: string, brandId?: string): Promise<Program | null> {
        if (brandId) {
            const program = await this.prisma.program.findUnique({
                where: {
                    brandId_slug: {
                        brandId,
                        slug,
                    },
                },
            });
            return program ? this.mapToEntity(program) : null;
        }

        const matches = await this.prisma.program.findMany({
            where: { slug },
            take: 2,
        });

        if (matches.length === 0) return null;
        if (matches.length === 1) return this.mapToEntity(matches[0]);

        this.logger.warn(
            `findBySlug("${slug}") is ambiguous across brands with no brandId to disambiguate - ` +
            `matching programs: ${matches.map((p) => `${p.id} (brand ${p.brandId})`).join(', ')}. Refusing to guess; returning null.`,
        );
        return null;
    }

    async create(data: Partial<Program>): Promise<Program> {
        const program = await this.prisma.program.create({
            data: {
                brandId: data.brandId!,
                name: data.name!,
                slug: data.slug!,
                description: data.description,
                shortDescription: data.shortDescription,
                theme: data.theme,
                year: data.year!,
                startDate: data.startDate!,
                endDate: data.endDate!,
                applicationDeadline: data.applicationDeadline!,
                location: data.location,
                capacity: data.capacity,
                isPublished: data.isPublished ?? false,
                isVisibleToUsers: data.isVisibleToUsers ?? true,
                isActive: data.isActive ?? true,
                status: data.status ?? 'draft',
                thumbnailUrl: data.thumbnailUrl,
                bannerUrl: data.bannerUrl,
                videoUrl: data.videoUrl,
                requireEmailVerification: data.requireEmailVerification ?? true,
                currency: data.currency ?? 'USD',
                enableCurrencyConversion: data.enableCurrencyConversion ?? false,
                usdInIdr: data.usdInIdr as unknown as Prisma.Decimal,
                logoUrl: data.logoUrl,
                allowRegistration: data.allowRegistration ?? true,
                registrationOpenDate: data.registrationOpenDate,
                registrationCloseDate: data.registrationCloseDate,
                requirePayment: data.requirePayment ?? false,
                registrationFee: data.registrationFee as unknown as Prisma.Decimal, // Decimal handling
                requirementsDescription: data.requirementsDescription,
                benefitsDescription: data.benefitsDescription,
                termsAndConditions: data.termsAndConditions,
                essayGuidelineText: data.essayGuidelineText,
                essayGuidelineUrl: data.essayGuidelineUrl,
                previewChecklistItems: data.previewChecklistItems ?? [],
                metaTitle: data.metaTitle,
                metaDescription: data.metaDescription,
                paymentInfoHtml: data.paymentInfoHtml,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                contactWhatsapp: data.contactWhatsapp,
                contactAddress: data.contactAddress,
                metaKeywords: data.metaKeywords,
                landingContent: (data.landingContent ?? {}) as Prisma.InputJsonValue,
            },
            include: {
                brand: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        return this.mapToEntity(program);
    }

    async update(id: string, data: Partial<Program>): Promise<Program> {
        const program = await this.prisma.program.update({
            where: { id },
            data: {
                brandId: data.brandId,
                name: data.name,
                slug: data.slug,
                description: data.description,
                shortDescription: data.shortDescription,
                programType: data.programType,
                programFormat: data.programFormat,
                year: data.year,
                theme: data.theme,
                startDate: data.startDate,
                endDate: data.endDate,
                applicationDeadline: data.applicationDeadline,
                location: data.location,
                capacity: data.capacity,
                isPublished: data.isPublished,
                isVisibleToUsers: data.isVisibleToUsers,
                isActive: data.isActive,
                status: data.status,
                thumbnailUrl: data.thumbnailUrl,
                bannerUrl: data.bannerUrl,
                videoUrl: data.videoUrl,
                requireEmailVerification: data.requireEmailVerification,
                currency: data.currency,
                enableCurrencyConversion: data.enableCurrencyConversion,
                usdInIdr: data.usdInIdr as unknown as Prisma.Decimal,
                logoUrl: data.logoUrl,
                allowRegistration: data.allowRegistration,
                registrationOpenDate: data.registrationOpenDate,
                registrationCloseDate: data.registrationCloseDate,
                requirePayment: data.requirePayment,
                registrationFee: data.registrationFee as unknown as Prisma.Decimal,
                requirementsDescription: data.requirementsDescription,
                benefitsDescription: data.benefitsDescription,
                termsAndConditions: data.termsAndConditions,
                essayGuidelineText: data.essayGuidelineText,
                essayGuidelineUrl: data.essayGuidelineUrl,
                previewChecklistItems: data.previewChecklistItems,
                metaTitle: data.metaTitle,
                metaDescription: data.metaDescription,
                paymentInfoHtml: data.paymentInfoHtml,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                contactWhatsapp: data.contactWhatsapp,
                contactAddress: data.contactAddress,
                metaKeywords: data.metaKeywords,
                landingContent: data.landingContent as Prisma.InputJsonValue | undefined,
                partnersCanvaUrl: data.partnersCanvaUrl,
            },
            include: {
                brand: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        return this.mapToEntity(program);
    }

    async delete(id: string): Promise<void> {
        await this.prisma.program.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false,
            },
        });
    }

    /**
     * Resolve an active brand's id from a host/url string, cached (audit
     * M34). Mirrors LandingService.resolveBrand()'s exact-match-then-ILIKE
     * resolution and cache pattern (CacheService, CACHE_TTL.MEDIUM ~5min) —
     * see the comment at the findAll() call site for why that method itself
     * isn't reused directly. Only successful resolutions are cached, same as
     * resolveBrand, so a newly-added brand domain isn't stuck behind a stale
     * miss.
     *
     * This resolves to ONE brand, where the previous join filter matched every
     * brand whose websiteUrl contained the host. That is equivalent only while
     * no active brand's websiteUrl is a substring of another's - checked in
     * production (8 active brands, zero such pairs). If that ever stops being
     * true, a host like ybb.co alongside events.ybb.co becomes ambiguous, and
     * the contains-branch would silently drop the other brand's programmes.
     * orderBy createdAt keeps the choice deterministic rather than arbitrary,
     * so the failure would at least be stable and reproducible.
     */
    private async resolveBrandIdByUrl(url: string): Promise<string | null> {
        const cacheKey = CACHE_KEYS.PROGRAM_BRAND_URL_RESOLVE(url.trim().toLowerCase());
        const cached = await this.cacheService.get<string>(cacheKey);
        if (cached) {
            return cached;
        }

        let brand = await this.prisma.brand.findFirst({
            where: { websiteUrl: url, isActive: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });

        if (!brand) {
            brand = await this.prisma.brand.findFirst({
                where: { websiteUrl: { contains: url, mode: 'insensitive' }, isActive: true },
                select: { id: true },
                orderBy: { createdAt: 'asc' },
            });
        }

        if (!brand) {
            return null;
        }

        await this.cacheService.set(cacheKey, brand.id, CACHE_TTL.MEDIUM);
        return brand.id;
    }

    private mapToEntity(prismaEntity: Prisma.ProgramGetPayload<{ include: { brand: { select: { name: true } } } }> | Prisma.ProgramGetPayload<Record<string, never>>): Program {
        return new Program(
            prismaEntity.id,
            prismaEntity.brandId,
            prismaEntity.name,
            prismaEntity.slug,
            prismaEntity.description,
            prismaEntity.shortDescription,
            prismaEntity.programType,
            prismaEntity.programFormat,
            prismaEntity.year,
            prismaEntity.startDate,
            prismaEntity.endDate,
            prismaEntity.applicationDeadline,
            prismaEntity.location,
            prismaEntity.capacity,
            prismaEntity.isPublished,
            prismaEntity.isVisibleToUsers,
            prismaEntity.isActive,
            prismaEntity.status,
            prismaEntity.thumbnailUrl,
            prismaEntity.bannerUrl,
            prismaEntity.videoUrl,
            prismaEntity.requireEmailVerification,
            prismaEntity.currency,
            prismaEntity.enableCurrencyConversion,
            prismaEntity.usdInIdr ? Number(prismaEntity.usdInIdr) : null,
            prismaEntity.logoUrl,
            prismaEntity.allowRegistration,
            prismaEntity.registrationOpenDate,
            prismaEntity.registrationCloseDate,
            prismaEntity.requirePayment,
            prismaEntity.registrationFee ? Number(prismaEntity.registrationFee) : null,
            prismaEntity.requirementsDescription,
            prismaEntity.benefitsDescription,
            prismaEntity.termsAndConditions,
            prismaEntity.essayGuidelineText,
            prismaEntity.essayGuidelineUrl,
            prismaEntity.previewChecklistItems ?? [],
            prismaEntity.metaTitle,
            prismaEntity.metaDescription,
            prismaEntity.createdAt,
            prismaEntity.updatedAt,
            prismaEntity.deletedAt,
            (prismaEntity as Record<string, unknown> & { brand?: { name?: string } }).brand?.name ?? null,
            prismaEntity.theme,
            prismaEntity.paymentInfoHtml ?? null,
            prismaEntity.contactEmail ?? null,
            prismaEntity.contactPhone ?? null,
            prismaEntity.contactWhatsapp ?? null,
            prismaEntity.contactAddress ?? null,
            prismaEntity.metaKeywords ?? null,
            (prismaEntity.landingContent as Record<string, unknown>) ?? {},
            prismaEntity.partnersCanvaUrl ?? null,
        );
    }
}
