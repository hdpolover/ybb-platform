import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
    ExchangeRateResponseDto,
    ExchangeRateHistoryResponseDto,
} from '../../../presentation/dto/exchange-rate.dto';

@Injectable()
export class UpdateExchangeRateHandler {
    constructor(private readonly prisma: PrismaService) {}

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

        return {
            programId: updatedProgram.id,
            usdInIdr: Number(updatedProgram.usdInIdr),
            source: 'program',
            updatedAt: updatedProgram.updatedAt,
        };
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
