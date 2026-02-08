import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalDocumentsQuery } from '../portal-queries';
import { 
    PortalDocumentResponseDto, 
    DocumentItemDto 
} from '../../../presentation/dto/portal-document.dto';

@Injectable()
@QueryHandler(GetPortalDocumentsQuery)
export class GetPortalDocumentsHandler implements IQueryHandler<GetPortalDocumentsQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(query: GetPortalDocumentsQuery): Promise<PortalDocumentResponseDto> {
        const { userId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_DOCUMENTS(userId);
        const cached = await this.cacheService.get<PortalDocumentResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Cache miss - fetch from database
        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            select: {
                id: true,
                status: true,
                program: {
                    select: {
                        id: true,
                        resources: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                type: true,
                                fileUrl: true,
                                isPublic: true,
                                updatedAt: true
                            },
                            orderBy: { order: 'asc' }
                        }
                    }
                },
                documents: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        fileUrl: true,
                        generatedAt: true
                    }
                }
            }
        });

        const programResources: DocumentItemDto[] = [];
        const myDocuments: DocumentItemDto[] = [];

        if (application) {
            // 1. Program Resources (Guidebooks etc)
            for (const res of application.program.resources) {
                if (!res.isActive || (!res.isPublic && application.status === 'draft')) continue;

                programResources.push({
                    id: res.id,
                    title: res.title,
                    description: res.description || '',
                    category: 'program_resource',
                    fileUrl: res.fileUrl,
                    status: 'available',
                    updatedAt: res.updatedAt
                });
            }

            // 2. My Documents (Certificates, LOAs, etc.)
            for (const doc of application.documents) {
                myDocuments.push({
                    id: doc.id,
                    title: doc.name,
                    description: doc.name, // Using name as description since notes is missing
                    category: 'participant_upload',
                    fileUrl: doc.fileUrl,
                    status: 'verified', // Assuming if it exists here it's good, or add verification logic
                    updatedAt: doc.generatedAt // Using generatedAt
                });
            }
        }

        const result = {
            programResources,
            myDocuments
        };

        // Cache the result for 5 minutes
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);

        return result;
    }
}
