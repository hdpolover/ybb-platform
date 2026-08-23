import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
    ExchangeRateResponseDto,
    ExchangeRateHistoryResponseDto,
} from '../../../presentation/dto/exchange-rate.dto';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

@Injectable()
export class UpdateExchangeRateHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async getExchangeRate(programId: string): Promise<ExchangeRateResponseDto> {
        const program = await this.prisma.program.findUnique({
            where: { id: programId },
        });

        if (!program) {
            throw new NotFoundException(`Program ${programId} not found`);
        }

        return {
            programId: program.id,
            usdInIdr: program.usdInIdr ? Number(program.usdInIdr) : null,
            source: program.usdInIdr ? 'program' : 'unset',
            updatedAt: program.updatedAt,
        };
    }

    async updateExchangeRate(
        programId: string,
        newRate: number,
        changedBy: string,
        reason?: string,
    ): Promise<ExchangeRateResponseDto> {
        const program = await this.prisma.program.findUnique({
            where: { id: programId },
            select: {
                id: true,
                brandId: true,
                usdInIdr: true,
            },
        });

        if (!program) {
            throw new NotFoundException(`Program ${programId} not found`);
        }

        const oldRate = program.usdInIdr ? Number(program.usdInIdr) : newRate;

        // Update program and create history entry in a transaction
        const [updatedProgram] = await this.prisma.$transaction([
            this.prisma.program.update({
                where: { id: programId },
                data: { usdInIdr: newRate },
            }),
            this.prisma.programExchangeRateHistory.create({
                data: {
                    programId,
                    oldRate,
                    newRate,
                    changedBy,
                    reason: reason || null,
                },
            }),
        ]);

        // Invalidate caches so pricing changes are reflected immediately
        await this.invalidateExchangeRateCaches(program.brandId);

        return {
            programId: updatedProgram.id,
            usdInIdr: Number(updatedProgram.usdInIdr),
            source: 'program',
            updatedAt: updatedProgram.updatedAt,
        };
    }

    /**
     * Invalidate caches when exchange rate is updated. The rate feeds the
     * pricing tiers / registration CTA on the program landing page, so it
     * needs all three landing cache layers busted (audit found this handler
     * only cleared Redis and never fired the Next.js revalidate hook).
     * Portal payment/dashboard caches for enrolled participants are outside
     * the landing-page scope the shared service owns, so they're cleared
     * separately here.
     */
    private async invalidateExchangeRateCaches(brandId: string): Promise<void> {
        await this.landingCacheInvalidation.invalidate(brandId, {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });

        try {
            await Promise.all([
                this.cacheService.invalidateByPattern('portal:payments:*'),
                this.cacheService.invalidateByPattern('portal:dashboard:*'),
            ]);
        } catch (error) {
            // Log but don't throw - cache invalidation failures shouldn't break exchange rate updates
            console.error('Failed to invalidate exchange rate portal caches:', error);
        }
    }

    async getExchangeRateHistory(
        programId: string,
        page = 1,
        limit = 20,
    ): Promise<ExchangeRateHistoryResponseDto> {
        const program = await this.prisma.program.findUnique({
            where: { id: programId },
        });

        if (!program) {
            throw new NotFoundException(`Program ${programId} not found`);
        }

        const skip = (page - 1) * limit;

        const [total, history] = await Promise.all([
            this.prisma.programExchangeRateHistory.count({
                where: { programId },
            }),
            this.prisma.programExchangeRateHistory.findMany({
                where: { programId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    admin: {
                        select: { id: true, email: true },
                    },
                },
            }),
        ]);

        return {
            history: history.map((h) => ({
                id: h.id,
                oldRate: Number(h.oldRate),
                newRate: Number(h.newRate),
                changedBy: h.admin.email,
                reason: h.reason || undefined,
                createdAt: h.createdAt,
            })),
            total,
        };
    }
}
