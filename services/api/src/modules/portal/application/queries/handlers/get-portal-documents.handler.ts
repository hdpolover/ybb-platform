import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { LoaEligibilityService } from '../../services/loa-eligibility.service';
import { GetPortalDocumentsQuery } from '../portal-queries';
import {
    PortalDocumentResponseDto,
    DocumentItemDto
} from '../../../presentation/dto/portal-document.dto';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';

@Injectable()
@QueryHandler(GetPortalDocumentsQuery)
export class GetPortalDocumentsHandler implements IQueryHandler<GetPortalDocumentsQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly loaEligibilityService: LoaEligibilityService,
    ) {}

    async execute(query: GetPortalDocumentsQuery): Promise<PortalDocumentResponseDto> {
        const { userId } = query;

        const cacheKey = CACHE_KEYS.PORTAL_DOCUMENTS(userId);
        const cached = await this.cacheService.get<PortalDocumentResponseDto>(cacheKey);
        if (cached) return cached;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            select: {
                id: true,
                programId: true,
                status: true,
                registrationPaymentStatus: true,
                programPaymentStatus: true,
                pricingTierId: true,
                program: {
                    select: {
                        id: true,
                        resources: {
                            where: { isActive: true },
                            select: {
                                id: true, title: true, description: true,
                                type: true, fileUrl: true, isPublic: true, updatedAt: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                documents: {
                    where: { deletedAt: null },
                    select: {
                        id: true, name: true, type: true, fileUrl: true,
                        signedCopyUrl: true, submissionStatus: true, submissionNote: true,
                        generatedAt: true, templateId: true,
                        // LOA on-demand fields (Task 9)
                        documentNumber: true, downloadCount: true, firstDownloadedAt: true,
                    },
                },
                invoices: {
                    select: { pricingTierId: true, status: true },
                },
            },
        });

        const programResources: DocumentItemDto[] = [];
        const myDocuments: DocumentItemDto[] = [];

        if (application) {
            // Fetch document templates separately (no back-relation on Program model)
            const documentTemplates = await this.prisma.documentTemplate.findMany({
                where: { programId: application.programId, isActive: true, deletedAt: null },
                select: {
                    id: true, name: true, type: true, description: true,
                    templateUrl: true, audienceType: true, audienceConfig: true,
                    order: true, updatedAt: true,
                },
                orderBy: { order: 'asc' },
            });

            // 1. Program Resources (Guidelines)
            for (const res of application.program.resources) {
                if (!res.isPublic && application.status === 'draft') continue;
                programResources.push({
                    id: res.id,
                    title: res.title,
                    description: res.description ?? '',
                    category: 'program_resource',
                    fileUrl: res.fileUrl,
                    status: 'available',
                    documentType: 'program_resource',
                    updatedAt: res.updatedAt,
                });
            }

            // 2. Document Templates (Agreement Letters + Complementary Docs)
            for (const tmpl of documentTemplates) {
                if (!isAudienceEligible(tmpl, application)) continue;

                // Find existing participant document linked to this template
                const participantDoc = application.documents.find(
                    (d) => d.templateId === tmpl.id,
                );

                if (tmpl.type === 'agreement_letter') {
                    myDocuments.push({
                        id: tmpl.id,
                        title: tmpl.name,
                        description: tmpl.description ?? '',
                        category: 'document_template',
                        fileUrl: tmpl.templateUrl ?? undefined,
                        status: participantDoc?.submissionStatus ?? 'pending_upload',
                        signedCopyUrl: participantDoc?.signedCopyUrl ?? undefined,
                        submissionStatus: participantDoc?.submissionStatus ?? 'pending_upload',
                        documentType: 'agreement_letter',
                        updatedAt: tmpl.updatedAt,
                    });
                } else if (tmpl.type === 'complementary_document') {
                    programResources.push({
                        id: tmpl.id,
                        title: tmpl.name,
                        description: tmpl.description ?? '',
                        category: 'document_template',
                        fileUrl: tmpl.templateUrl ?? undefined,
                        status: 'available',
                        documentType: 'complementary_document',
                        updatedAt: tmpl.updatedAt,
                    });
                } else if (tmpl.type === 'letter_of_acceptance') {
                    // Task 9: Surface LOA based on eligibility, not on a stored fileUrl.
                    // Eligible → downloadable=true (on-demand PDF via GET /v1/portal/loa/download).
                    // Ineligible → downloadable=false (locked; no released batch covers them yet).
                    const eligibility = await this.loaEligibilityService.checkEligibility(
                        application.id,
                        application.programId,
                    );
                    myDocuments.push({
                        id: participantDoc?.id ?? tmpl.id,
                        title: tmpl.name,
                        description: tmpl.description ?? '',
                        category: 'document_template',
                        // fileUrl intentionally omitted for LOA — download via dedicated endpoint
                        status: eligibility.eligible ? 'verified' : 'available',
                        documentType: 'letter_of_acceptance',
                        updatedAt: participantDoc?.generatedAt ?? tmpl.updatedAt,
                        downloadable: eligibility.eligible,
                        documentNumber: participantDoc?.documentNumber ?? undefined,
                    });
                }
            }

            // 3. Previously generated documents (LOA, certificates, etc.)
            for (const doc of application.documents) {
                if (doc.templateId) continue; // Already handled above via template loop
                myDocuments.push({
                    id: doc.id,
                    title: doc.name,
                    description: doc.name,
                    category: 'participant_upload',
                    fileUrl: doc.fileUrl,
                    status: 'verified',
                    documentType: doc.type,
                    updatedAt: doc.generatedAt,
                });
            }
        }

        const maskedProgramResources = await Promise.all(
            programResources.map(async (item) => ({
                ...item,
                fileUrl:
                    typeof item.fileUrl === 'string' && item.fileUrl.trim().length > 0
                        ? await resolveMaskedFileUrl(this.prisma, item.fileUrl)
                        : item.fileUrl,
                signedCopyUrl:
                    typeof item.signedCopyUrl === 'string' && item.signedCopyUrl.trim().length > 0
                        ? await resolveMaskedFileUrl(this.prisma, item.signedCopyUrl)
                        : item.signedCopyUrl,
            })),
        );

        const maskedMyDocuments = await Promise.all(
            myDocuments.map(async (item) => ({
                ...item,
                fileUrl:
                    typeof item.fileUrl === 'string' && item.fileUrl.trim().length > 0
                        ? await resolveMaskedFileUrl(this.prisma, item.fileUrl)
                        : item.fileUrl,
                signedCopyUrl:
                    typeof item.signedCopyUrl === 'string' && item.signedCopyUrl.trim().length > 0
                        ? await resolveMaskedFileUrl(this.prisma, item.signedCopyUrl)
                        : item.signedCopyUrl,
            })),
        );

        const result = { programResources: maskedProgramResources, myDocuments: maskedMyDocuments };
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
        return result;
    }
}

function isAudienceEligible(
    tmpl: { audienceType: string; audienceConfig: unknown },
    application: {
        status: string;
        registrationPaymentStatus: string;
        programPaymentStatus: string;
        pricingTierId: string | null;
        invoices: { pricingTierId: string; status: string }[];
    },
): boolean {
    const config = tmpl.audienceConfig as Record<string, unknown>;
    switch (tmpl.audienceType) {
        case 'all_registered':
            return true;
        case 'paid_any':
            return (
                application.registrationPaymentStatus === 'paid' ||
                application.programPaymentStatus === 'paid'
            );
        case 'paid_pricing_tier': {
            const ids = (config.pricingTierIds as string[]) ?? [];
            return application.invoices.some(
                (inv) => inv.status === 'paid' && ids.includes(inv.pricingTierId),
            );
        }
        case 'specific_status': {
            const statuses = (config.statuses as string[]) ?? [];
            return statuses.includes(application.status);
        }
        default:
            return false;
    }
}
