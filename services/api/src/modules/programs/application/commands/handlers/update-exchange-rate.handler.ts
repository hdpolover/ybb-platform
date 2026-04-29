import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
    ExchangeRateResponseDto,
    ExchangeRateHistoryResponseDto,
} from '../../../presentation/dto/exchange-rate.dto';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';

@Injectable()
export class UpdateExchangeRateHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async getExchangeRate(programId: string): Promise<ExchangeRateResponseDto> {
        const program = await this.prisma.program.findUnique({
            where: { id: programId },
            include: {
                brand: {
                    include: { settings: true },
                },
            },
        });

        if (!program) {
            throw new NotFoundException(`Program ${programId} not found`);
        }

        // Program-level rate takes priority, fall back to brand setting
        const programRate = program.usdInIdr ? Number(program.usdInIdr) : null;
        const brandRate = program.brand?.settings?.usdInIdr
            ? Number(program.brand.settings.usdInIdr)
            : 16000;

        return {
            programId: program.id,
            usdInIdr: programRate ?? brandRate,
            source: programRate !== null ? 'program' : 'brand',
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
            include: {
                brand: {
                    include: { settings: true },
                },
            },
        });

        if (!program) {
            throw new NotFoundException(`Program ${programId} not found`);
        }

        // Determine old rate (program-level or brand fallback)
        const oldRate = program.usdInIdr
            ? Number(program.usdInIdr)
            : program.brand?.settings?.usdInIdr
              ? Number(program.brand.settings.usdInIdr)
              : 16000;

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
        await this.invalidateExchangeRateCaches(programId, program.brandId);

        return {
            programId: updatedProgram.id,
            usdInIdr: Number(updatedProgram.usdInIdr),
            source: 'program',
            updatedAt: updatedProgram.updatedAt,
        };
    }

    /**
     * Invalidate caches when exchange rate is updated
     */
    private async invalidateExchangeRateCaches(programId: string, brandId: string): Promise<void> {
        try {
            await Promise.all([
                this.cacheService.invalidateBrandLandingCaches(brandId),
                this.cacheService.invalidateByPattern(`program:detail:${programId}*`),
                this.cacheService.invalidateByPattern('portal:payments:*'),
                this.cacheService.invalidateByPattern('portal:dashboard:*'),
            ]);
        } catch (error) {
            // Log but don't throw - cache invalidation failures shouldn't break exchange rate updates
            console.error('Failed to invalidate exchange rate caches:', error);
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
