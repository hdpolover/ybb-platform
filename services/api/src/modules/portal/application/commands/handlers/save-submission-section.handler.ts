import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { SaveSubmissionSectionCommand } from '../../queries/portal-queries';
import { SubmissionSection } from '../../../presentation/dto/save-submission-section.dto';

/**
 * Save Submission Section Handler
 *
 * Merges section data into the appropriate JSON field on ParticipantApplication.
 * Supports personal_info, essays, and documents sections.
 */
@Injectable()
export class SaveSubmissionSectionHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) { }

    async execute(command: SaveSubmissionSectionCommand): Promise<{ success: boolean; section: string }> {
        const { userId, section, data } = command;

        this.validateSection(section);

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                status: true,
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
            },
        });

        if (!application) throw new NotFoundException('No active application found');

        if (application.status !== 'draft') {
            throw new BadRequestException(
                `Cannot edit application in "${application.status}" status. Only drafts can be edited.`,
            );
        }

        const updateData = this.buildUpdatePayload(section, application, data);

        await this.prisma.participantApplication.update({
            where: { id: application.id },
            data: updateData,
        });

        await this.invalidateCaches(userId);

        return { success: true, section };
    }

    private validateSection(section: string): void {
        const validSections = Object.values(SubmissionSection) as string[];
        if (!validSections.includes(section)) {
            throw new BadRequestException(
                `Invalid section "${section}". Valid sections: ${validSections.join(', ')}`,
            );
        }
    }

    private buildUpdatePayload(
        section: string,
        application: any,
        data: Record<string, any>,
    ): Record<string, any> {
        switch (section) {
            case SubmissionSection.PERSONAL_INFO: {
                const existing = (application.personalData as Record<string, any>) || {};
                return { personalData: { ...existing, ...data } };
            }
            case SubmissionSection.ESSAYS: {
                const existing = (application.essayAnswers as Record<string, any>) || {};
                return { essayAnswers: { ...existing, ...data } };
            }
            case SubmissionSection.DOCUMENTS: {
                const existing = (application.uploadedFiles as Record<string, any>) || {};
                return { uploadedFiles: { ...existing, ...data } };
            }
            default:
                throw new BadRequestException(`Unsupported section: ${section}`);
        }
    }

    private async invalidateCaches(userId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSIONS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId)),
        ]);
    }
}
