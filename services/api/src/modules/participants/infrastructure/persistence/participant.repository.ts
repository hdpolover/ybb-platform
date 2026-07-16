import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '../../../../shared/infrastructure/prisma/prisma-read.service';
import { IParticipantRepository } from '../../../../core/interfaces/repositories/participant.repository.interface';
import { Participant } from '../../../../core/entities/participant.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class ParticipantRepository implements IParticipantRepository {
    private readonly readClient: PrismaService | PrismaReadService;

    constructor(
        private readonly prisma: PrismaService,
        readPrisma?: PrismaReadService,
    ) {
        this.readClient = readPrisma ?? prisma;
    }

    async findByUserId(userId: string): Promise<Participant | null> {
        const participant = await this.readClient.participant.findUnique({
            where: { userId },
        });

        if (!participant) return null;

        // Manual mapping or cast if types align closely
        // Prisma Gender enum might need handling if mapped to string
        return participant as unknown as Participant;
    }

    async create(data: Partial<Participant>): Promise<Participant> {
        // We assume userId is provided in data
        const { userId, ...rest } = data;
        if (!userId) throw new Error('UserId is required to create a participant');

        // Remove undefined fields to avoid Prisma errors if any
        const createData: Prisma.ParticipantCreateInput = {
            ...(this.mapToPrismaInput(rest) as Prisma.ParticipantCreateInput),
            user: { connect: { id: userId } },
            fullName: rest.fullName || 'Unknown', // Required field
        };

        const created = await this.prisma.participant.create({
            data: createData,
        });

        return created as unknown as Participant;
    }

    async update(userId: string, data: Partial<Participant>): Promise<Participant> {
        const updateData = this.mapToPrismaInput(data);

        const updated = await this.prisma.participant.update({
            where: { userId },
            data: updateData,
        });

        return updated as unknown as Participant;
    }

    private mapToPrismaInput(data: Partial<Participant>): Prisma.ParticipantUpdateInput {
        // Helper to cleanup undefined or handle incompatible types
        const input: Prisma.ParticipantUpdateInput = { ...data } as Prisma.ParticipantUpdateInput;

        delete (input as Record<string, unknown>).userId; // handled separately or immutable id
        delete (input as Record<string, unknown>).id;

        // Ensure enumerables or special types are correct if needed
        // For now assuming direct mapping works for most fields
        return input;
    }
}
