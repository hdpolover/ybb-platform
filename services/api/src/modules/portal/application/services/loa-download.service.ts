import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { LoaRenderDataService } from './loa-render-data.service';
import { PortalCacheService } from './portal-cache.service';
import { resolveLoaSignature, buildGenerateLoaParams, resolveLoaLayoutConfig } from '@shared/utils/loa-render-payload.util';

export interface LoaDownloadResult {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class LoaDownloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portalCacheService: PortalCacheService,
    private readonly loaEligibilityService: LoaEligibilityService,
    private readonly loaDocumentNumberService: LoaDocumentNumberService,
    private readonly loaRenderDataService: LoaRenderDataService,
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  async downloadLoa(userId: string, brandId: string): Promise<LoaDownloadResult> {
    // 1. Resolve participant
    const participant = await this.portalCacheService.getParticipantProfile(userId);
    if (!participant) throw new NotFoundException('Participant not found');

    // 2. Resolve the participant's application first (Bug 1 fix: invert resolution order).
    //    A brand can have >1 active program, so resolving program by brandId alone risks
    //    picking the wrong one. Instead we find the application and read programId from it.
    const application = await this.prisma.participantApplication.findFirst({
      where: { participantId: participant.id },
      select: { id: true, programId: true },
    });
    if (!application) throw new ForbiddenException('Invitation Letter not available');

    // 3. Resolve the program deterministically from the application's own programId.
    //    Only `id`/`year` needed here - LoaRenderDataService (step 8) fetches the full
    //    program row on its own.
    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: { id: true, year: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    // 4. Eligibility gate
    const eligibility = await this.loaEligibilityService.checkEligibility(application.id, program.id);
    if (!eligibility.eligible) throw new ForbiddenException('Invitation Letter not available');

    // 5. Fetch the active LOA document template (moved before assignOrGet so we can pass
    //    its id to assignOrGet - Bug 2 fix: templateId must be set on the created row)
    const template = await this.prisma.documentTemplate.findFirst({
      where: { programId: program.id, type: 'letter_of_acceptance', isActive: true, deletedAt: null },
      select: { id: true, htmlContent: true, placeholders: true, layoutConfig: true },
    });
    if (!template || !template.htmlContent) {
      throw new NotFoundException('Invitation Letter template not configured');
    }

    // 6. Assign or reuse stable document number (Bug 2 fix: pass template.id so the
    //    ParticipantDocument row carries templateId, enabling GetPortalDocumentsHandler
    //    to match it by templateId and skip it in the uploaded-docs loop)
    const programCode = String(program.year);
    const { docNumber, existingDocId } = await this.loaDocumentNumberService.assignOrGet(
      application.id,
      program.id,
      programCode,
      template.id,
    );

    // 7. Extract layout settings from layoutConfig - shared with the admin
    //    preview handler, see resolveLoaLayoutConfig for why.
    const layoutConfig = (template.layoutConfig ?? {}) as Record<string, unknown>;
    const resolvedLayoutConfig = resolveLoaLayoutConfig(layoutConfig);

    // 7b. Resolve signature - legacy fallback is raw layoutConfig.signatureUrl with
    // empty signer name/title. If layoutConfig.signatureId is set, look up the
    // reusable brand-scoped Signature record and supersede the legacy values with
    // its imageUrl/name/title. Any lookup failure degrades gracefully back to the
    // legacy fallback - a bad signature reference must never break LOA download.
    const { signatureUrl, signerName, signerTitle } = await resolveLoaSignature(this.prisma, {
      signatureUrl: layoutConfig['signatureUrl'] as string | undefined,
      signatureId: layoutConfig['signatureId'] as string | undefined,
    });

    // 8. Build the flat placeholder source map - the single shared piece with the
    //    admin preview endpoint. See LoaRenderDataService.
    const { sourceMap, programDisplayName, programBatch } = await this.loaRenderDataService.buildSourceMapForApplication(
      application.id,
      { documentNumber: docNumber, signerName, signerTitle },
    );

    const placeholders = (template.placeholders ?? []) as Array<{ key: string; source: string }>;

    // 9. Generate PDF via file service - no storage upload
    const buffer = await this.fileServiceClient.generateLoa(
      buildGenerateLoaParams({
        htmlContent: template.htmlContent,
        layoutConfig: resolvedLayoutConfig,
        placeholders,
        sourceMap,
        documentNumber: docNumber,
        signatureUrl,
        signerName,
        signerTitle,
        programDisplayName,
        programBatch,
      }),
    );

    // 10. Record download tracking
    const now = new Date();
    await this.prisma.participantDocument.update({
      where: { id: existingDocId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: now,
        loaReleaseBatchId: eligibility.batchId,
      },
    });
    // Set firstDownloadedAt only on first download (null guard avoids overwriting)
    await this.prisma.participantDocument.updateMany({
      where: { id: existingDocId, firstDownloadedAt: null },
      data: { firstDownloadedAt: now },
    });

    return { buffer, filename: `LOA-${docNumber}.pdf` };
  }
}
