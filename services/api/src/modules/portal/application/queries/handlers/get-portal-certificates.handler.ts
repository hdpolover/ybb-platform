import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalCertificatesQuery } from '../portal-queries';
import {
    PortalCertificatesResponseDto,
    PortalCertificateItemDto,
} from '../../../presentation/dto/portal-certificate.dto';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';

/**
 * Get Portal Certificates Handler
 *
 * Lists all certificates and documents for the logged-in user
 * across all their applications.
 */
@Injectable()
@QueryHandler(GetPortalCertificatesQuery)
export class GetPortalCertificatesHandler
    implements IQueryHandler<GetPortalCertificatesQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) { }

    async execute(
        query: GetPortalCertificatesQuery,
    ): Promise<PortalCertificatesResponseDto> {
        const { userId } = query;

        const cacheKey = CACHE_KEYS.PORTAL_CERTIFICATES(userId);
        const cached =
            await this.cacheService.get<PortalCertificatesResponseDto>(cacheKey);
        if (cached) return cached;

        const participant =
            await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const documents = await this.prisma.participantDocument.findMany({
            where: {
                application: { participantId: participant.id },
                deletedAt: null,
            },
            select: {
                id: true,
                documentNumber: true,
                name: true,
                type: true,
                fileUrl: true,
                fileType: true,
                generatedAt: true,
                downloadCount: true,
                application: {
                    select: {
                        program: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: { generatedAt: 'desc' },
        });

        const certificates: PortalCertificateItemDto[] = await Promise.all(
            documents.map(async (doc) => ({
                id: doc.id,
                documentNumber: doc.documentNumber || undefined,
                name: doc.name,
                type: doc.type,
                fileUrl:
                    typeof doc.fileUrl === 'string' && doc.fileUrl.trim().length > 0
                        ? await resolveMaskedFileUrl(this.prisma, doc.fileUrl)
                        : doc.fileUrl,
                fileType: doc.fileType,
                programName: doc.application.program.name,
                generatedAt: doc.generatedAt,
                downloadCount: doc.downloadCount,
            })),
        );

        const result: PortalCertificatesResponseDto = {
            certificates,
            total: certificates.length,
        };

        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
        return result;
    }
}
