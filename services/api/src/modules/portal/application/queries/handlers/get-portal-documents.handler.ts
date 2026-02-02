import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetPortalDocumentsQuery } from '../portal-queries';
import { 
    PortalDocumentResponseDto, 
    DocumentItemDto 
} from '../../../presentation/dto/portal-document.dto';

@Injectable()
@QueryHandler(GetPortalDocumentsQuery)
export class GetPortalDocumentsHandler implements IQueryHandler<GetPortalDocumentsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetPortalDocumentsQuery): Promise<PortalDocumentResponseDto> {
        const { userId } = query;
        const participant = await this.prisma.participant.findUnique({ where: { userId } });
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            include: { 
                program: { 
                    include: { resources: true } 
                },
                documents: true // Uploaded documents
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

        return {
            programResources,
            myDocuments
        };
    }
}
