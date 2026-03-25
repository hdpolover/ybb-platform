import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IAmbassadorRepository } from '../../../../core/interfaces/repositories/ambassador.repository.interface';
import { Ambassador } from '../../../../core/entities/ambassador.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class AmbassadorRepository implements IAmbassadorRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string): Promise<Ambassador | null> {
        const ambassador = await this.prisma.ambassador.findUnique({
            where: { userId },
        });

        if (!ambassador) return null;
        return ambassador as unknown as Ambassador;
    }

    async findByReferralCode(referralCode: string): Promise<Ambassador | null> {
        const ambassador = await this.prisma.ambassador.findUnique({
            where: { referralCode },
        });

        if (!ambassador) return null;
        return ambassador as unknown as Ambassador;
    }

    async create(data: Partial<Ambassador>): Promise<Ambassador> {
        if (!data.userId || !data.programId || !data.referralCode || !data.fullName) {
            throw new Error('Missing required fields for Ambassador creation');
        }

        const createData: Prisma.AmbassadorCreateInput = {
            user: { connect: { id: data.userId } },
            program: { connect: { id: data.programId } },
            referralCode: data.referralCode,
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            institution: data.institution,
            // Map gender string to enum if necessary, or let Prisma handle if compatible
            // gender: data.gender 
        };

        const created = await this.prisma.ambassador.create({
            data: createData,
        });

        return created as unknown as Ambassador;
    }

    async update(userId: string, data: Partial<Ambassador>): Promise<Ambassador> {
        // Helper to filter valid fields logic skipped for brevity
        const updateData: Prisma.AmbassadorUpdateInput = { ...data } as Prisma.AmbassadorUpdateInput;
        delete (updateData as Record<string, unknown>).userId;
        delete updateData.id;

        const updated = await this.prisma.ambassador.update({
            where: { userId },
            data: updateData,
        });

        return updated as unknown as Ambassador;
    }
}
