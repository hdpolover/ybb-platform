import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IParticipantRepository } from '../../../../core/interfaces/repositories/participant.repository.interface';
import { Participant } from '../../../../core/entities/participant.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class ParticipantRepository implements IParticipantRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string): Promise<Participant | null> {
        const participant = await this.prisma.participant.findUnique({
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
            user: { connect: { id: userId } },
            fullName: rest.fullName || 'Unknown', // Required field
            // Map other fields... spreading 'rest' might fail if it contains undefined for mapped fields
            ...this.mapToPrismaInput(rest),
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

    private mapToPrismaInput(data: Partial<Participant>): any {
        // Helper to cleanup undefined or handle incompatible types
        const input: any = { ...data };

        delete input.userId; // handled separately or immutable id
        delete input.id;

        // Ensure enumerables or special types are correct if needed
        // For now assuming direct mapping works for most fields
        return input;
    }
}
