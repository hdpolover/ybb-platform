import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { LoaEligibilityService } from '../../services/loa-eligibility.service';
import { DocumentAudienceService } from '../../services/document-audience.service';
import { GetPortalDocumentsQuery } from '../portal-queries';
import {
    PortalDocumentResponseDto,
    DocumentItemDto
} from '../../../presentation/dto/portal-document.dto';
import {
    buildFileUrlMaskMap,
    extractFileIdFromDownloadUrl,
    extractFileUuidFromUrl,
    getMaskedDownloadUrl,
} from '@shared/utils/masked-file-url';
import { PrivateFileUrlResolver, PRIVATE_FILE_UNAVAILABLE } from '@modules/files/application/private-file-url-resolver.service';
import { currentApplicationWhere, currentApplicationOrderBy } from '../../utils/current-application.query';

@Injectable()
@QueryHandler(GetPortalDocumentsQuery)
export class GetPortalDocumentsHandler implements IQueryHandler<GetPortalDocumentsQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly loaEligibilityService: LoaEligibilityService,
        private readonly documentAudienceService: DocumentAudienceService,
        private readonly privateFileUrlResolver: PrivateFileUrlResolver,
    ) {}

    /**
     * Resolve a document url for client consumption:
     *  - private category (documents/signed-copies) -> fresh presigned url
     *  - private but presign failed -> undefined (fail closed, never the stored url)
     *  - not a private category -> unchanged existing masked-download behavior
     *
     * `maskMap` comes from one batched files lookup for every document url on the
     * response (see buildFileUrlMaskMap) instead of two queries per url.
     */
    private async resolveDocumentUrl(
        url: string | null | undefined,
        maskMap: Map<string, string>,
    ): Promise<string | undefined> {
        if (typeof url !== 'string' || url.trim().length === 0) return url ?? undefined;

        const resolution = await this.privateFileUrlResolver.resolve(url);
        if (resolution === PRIVATE_FILE_UNAVAILABLE) return undefined;
        if (resolution) return resolution;

        // Same precedence as resolveMaskedFileUrl: already-masked url, then the file
        // id embedded in the url, then an exact stored-url match.
        const maskedId = extractFileIdFromDownloadUrl(url);
        if (maskedId) return getMaskedDownloadUrl(maskedId);

        const uuid = extractFileUuidFromUrl(url);
        return (uuid ? maskMap.get(uuid) : undefined) ?? maskMap.get(url) ?? url;
    }

    async execute(query: GetPortalDocumentsQuery): Promise<PortalDocumentResponseDto> {
        const { userId, programId } = query;

        const cacheKey = CACHE_KEYS.PORTAL_DOCUMENTS(userId, programId);
        const cached = await this.cacheService.get<PortalDocumentResponseDto>(cacheKey);
        if (cached) return cached;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id, programId),
            orderBy: currentApplicationOrderBy,
            select: {
                id: true,
                programId: true,
                status: true,
                submittedAt: true,
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
                                type: true, fileUrl: true, sourceType: true, linkUrl: true,
                                isPublic: true, updatedAt: true,
                            },
                            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
                    templateUrl: true, sourceType: true, linkUrl: true,
                    audienceType: true, audienceConfig: true,
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
                    fileUrl: (res.sourceType === 'link' ? res.linkUrl : res.fileUrl) ?? undefined,
                    status: 'available',
                    documentType: 'program_resource',
                    updatedAt: res.updatedAt,
                });
            }

            // 2. Document Templates (Agreement Letters + Complementary Docs)
            for (const tmpl of documentTemplates) {
                if (!this.documentAudienceService.isEligible(tmpl, application)) continue;

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
                        fileUrl: (tmpl.sourceType === 'link' ? tmpl.linkUrl : tmpl.templateUrl) ?? undefined,
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
                        fileUrl: (tmpl.sourceType === 'link' ? tmpl.linkUrl : tmpl.templateUrl) ?? undefined,
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

        const maskMap = await buildFileUrlMaskMap(
            this.prisma,
            [...programResources, ...myDocuments]
                .flatMap((item) => [item.fileUrl, item.signedCopyUrl])
                .filter((url): url is string => typeof url === 'string' && url.trim().length > 0),
        );

        const maskedProgramResources = await Promise.all(
            programResources.map(async (item) => ({
                ...item,
                fileUrl: await this.resolveDocumentUrl(item.fileUrl, maskMap),
                signedCopyUrl: await this.resolveDocumentUrl(item.signedCopyUrl, maskMap),
            })),
        );

        const maskedMyDocuments = await Promise.all(
            myDocuments.map(async (item) => ({
                ...item,
                fileUrl: await this.resolveDocumentUrl(item.fileUrl, maskMap),
                signedCopyUrl: await this.resolveDocumentUrl(item.signedCopyUrl, maskMap),
            })),
        );

        const result = { programResources: maskedProgramResources, myDocuments: maskedMyDocuments };
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
        return result;
    }
}
