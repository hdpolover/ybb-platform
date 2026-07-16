import { Injectable } from '@nestjs/common';
import { IAchievementsRepository } from '@core/interfaces/repositories/achievements.repository.interface';
import { ParticipantDocument } from '@core/entities/document.entity';
import { ParticipantAward } from '@core/entities/award.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class AchievementsRepository implements IAchievementsRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findDocumentsByApplicationId(applicationId: string): Promise<ParticipantDocument[]> {
        const docs = await this.prisma.participantDocument.findMany({
            where: { applicationId },
            include: { template: true },
            orderBy: { generatedAt: 'desc' },
        });

        return docs.map(d => new ParticipantDocument(
            d.id,
            d.applicationId,
            d.templateId || '',
            (d as typeof d & { documentNumber?: string }).documentNumber,
            d.fileUrl,
            d.generatedAt,
            d.downloadCount,
            d.template?.name || '',
        ));
    }

    async findAwardsByApplicationId(applicationId: string): Promise<ParticipantAward[]> {
        const awards = await this.prisma.participantAward.findMany({
            where: { applicationId },
            include: { programAward: true },
            orderBy: { awardedAt: 'desc' },
        });

        return awards.map(a => new ParticipantAward(
            a.id,
            a.applicationId,
            a.programAwardId,
            a.awardedAt,
            (a as typeof a & { notes?: string; certificateUrl?: string }).notes,
            (a as typeof a & { notes?: string; certificateUrl?: string }).certificateUrl,
            a.programAward.name,
            a.programAward.description,
            a.programAward.badgeUrl,
        ));
    }
}
