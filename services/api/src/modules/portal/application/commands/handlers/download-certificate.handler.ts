import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { DownloadCertificateCommand } from '../../queries/portal-queries';

/**
 * Download Certificate Handler
 *
 * Increments the download count for a certificate and returns
 * the file URL for the client to download.
 */
@Injectable()
export class DownloadCertificateHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly portalCacheService: PortalCacheService,
        private readonly cacheService: CacheService,
    ) { }

    async execute(
        command: DownloadCertificateCommand,
    ): Promise<{ fileUrl: string; fileName: string }> {
        const { userId, certificateId } = command;

        const participant =
            await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const document = await this.prisma.participantDocument.findUnique({
            where: { id: certificateId },
            select: {
                id: true,
                name: true,
                fileUrl: true,
                fileType: true,
                downloadCount: true,
                application: {
                    select: { participantId: true },
                },
            },
        });

        if (!document) throw new NotFoundException('Certificate not found');

        // Verify ownership
        if (document.application.participantId !== participant.id) {
            throw new ForbiddenException('You do not have access to this certificate');
        }

        // Increment download count
        await this.prisma.participantDocument.update({
            where: { id: certificateId },
            data: { downloadCount: document.downloadCount + 1 },
        });

        // Invalidate certificates list and participant stats (certificate count is in stats)
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_CERTIFICATES(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_STATS(participant.id)),
        ]);

        return {
            fileUrl: document.fileUrl,
            fileName: `${document.name}.${document.fileType}`,
        };
    }
}
