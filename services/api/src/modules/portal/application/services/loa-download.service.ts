import { Injectable, ForbiddenException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(LoaDownloadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portalCacheService: PortalCacheService,
    private readonly loaEligibilityService: LoaEligibilityService,
    private readonly loaDocumentNumberService: LoaDocumentNumberService,
    private readonly loaRenderDataService: LoaRenderDataService,
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  /**
   * Choose the application this LOA is for, by eligibility.
   *
   * The order here is the whole point. This used to pick one application with an
   * unordered findFirst and THEN gate it on eligibility, throwing without ever
   * trying another. For a participant with applications in several programs that
   * produced a silent false denial: pick the draft for program B, fail the
   * eligibility check, and report "Invitation Letter not available" while a
   * perfectly eligible acceptance sat one row over. It is invisible - no error,
   * no alert, and support cannot tell it apart from a batch that genuinely has
   * not been released, so it never becomes a bug report.
   *
   * Ordering the candidates would not have fixed that; it would have made it
   * worse. `updatedAt desc` promotes the newest row, and starting a fresh
   * application for another program is exactly what makes a row newest - so a
   * participant accepted in program A who later applies to program B would lose
   * access to their acceptance letter the moment they did so.
   *
   * So: filter to what is actually eligible, then let the count decide. One
   * candidate is the answer. Several is genuinely ambiguous and says so, rather
   * than guessing at a document someone submits to an embassy. None reports why.
   *
   * The candidate query itself lives in LoaEligibilityService so the documents
   * list computes `downloadable` from exactly the same set - those two used to
   * disagree, which is how a working-looking link could 403.
   *
   * The ACTIVE template check deliberately stays where it is, after selection: a
   * missing template is a program-level misconfiguration that affects every
   * participant of that program equally, so it cannot disambiguate BETWEEN two
   * applications and should be reported as its own failure.
   */
  private async resolveEligibleApplication(
    participantId: string,
    brandId: string,
    programId?: string,
  ): Promise<{ application: { id: string; programId: string }; eligibility: { eligible: boolean; batchId?: string } }> {
    const eligible = await this.loaEligibilityService.resolveEligibleApplications(
      participantId,
      brandId,
      programId,
    );

    if (eligible.length === 1) {
      return {
        application: eligible[0].application,
        eligibility: { eligible: true, batchId: eligible[0].batchId },
      };
    }

    if (eligible.length === 0) {
      throw new ForbiddenException('Invitation Letter not available');
    }

    this.logger.warn(
      `LOA: ${eligible.length} eligible applications for participant ${participantId}; programId required to disambiguate`,
    );
    throw new ConflictException(
      'You have more than one programme with an Invitation Letter available. Please choose a programme and try again.',
    );
  }

  async downloadLoa(userId: string, brandId: string, programId?: string): Promise<LoaDownloadResult> {
    // 1. Resolve participant
    const participant = await this.portalCacheService.getParticipantProfile(userId);
    if (!participant) throw new NotFoundException('Participant not found');

    // 2-4. Select the application BY eligibility rather than picking one and then
    //      gating it. See resolveEligibleApplication for why the order matters.
    const { application, eligibility } = await this.resolveEligibleApplication(
      participant.id,
      brandId,
      programId,
    );

    // Resolve the program from the application's own programId. Only `id`/`year`
    // needed here - LoaRenderDataService (step 8) fetches the full program row.
    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: { id: true, year: true },
    });
    if (!program) throw new NotFoundException('Program not found');

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
