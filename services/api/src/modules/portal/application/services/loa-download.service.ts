import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { PortalCacheService } from './portal-cache.service';

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
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  async downloadLoa(userId: string, brandId: string): Promise<LoaDownloadResult> {
    // 1. Resolve participant
    const participant = await this.portalCacheService.getParticipantProfile(userId);
    if (!participant) throw new NotFoundException('Participant not found');

    // 2. Resolve active program for brand
    const program = await this.prisma.program.findFirst({
      where: { brandId, isActive: true },
      select: {
        id: true,
        name: true,
        year: true,
        startDate: true,
        endDate: true,
        location: true,
        programType: true,
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    // 3. Resolve participant's application for this program
    const application = await this.prisma.participantApplication.findFirst({
      where: { participantId: participant.id, programId: program.id },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        participant: { select: { fullName: true } },
        participationCategory: { select: { name: true } },
      },
    });
    if (!application) throw new ForbiddenException('LOA not available');

    // 4. Eligibility gate
    const eligibility = await this.loaEligibilityService.checkEligibility(application.id, program.id);
    if (!eligibility.eligible) throw new ForbiddenException('LOA not available');

    // 5. Assign or reuse stable document number
    const programCode = String(program.year);
    const { docNumber, existingDocId } = await this.loaDocumentNumberService.assignOrGet(
      application.id,
      program.id,
      programCode,
    );

    // 6. Fetch the active LOA document template
    const template = await this.prisma.documentTemplate.findFirst({
      where: { programId: program.id, type: 'letter_of_acceptance', isActive: true, deletedAt: null },
      select: { htmlContent: true, placeholders: true, layoutConfig: true },
    });
    if (!template || !template.htmlContent) {
      throw new NotFoundException('LOA template not configured');
    }

    // 7. Build placeholder substitution map (mirrors GenerateLOAHandler source map)
    const now = new Date();
    const generatedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const sourceMap: Record<string, string> = {
      'participant.fullName': application.participant.fullName,
      'program.name': program.name,
      'program.batch': String(program.year),
      'generated_at': generatedAt,
      'participant_document.documentNumber': docNumber,
      'application.participationCategory.name': application.participationCategory?.name ?? '',
    };

    const placeholders = (template.placeholders ?? []) as Array<{ key: string; source: string }>;
    const placeholderData: Record<string, string> = {};
    for (const p of placeholders) {
      placeholderData[p.key] = sourceMap[p.source] ?? '';
    }
    // Always include document_number token even if not listed in placeholders definition
    placeholderData['{{document_number}}'] = docNumber;

    // 8. Extract layout settings from layoutConfig
    const layoutConfig = (template.layoutConfig ?? {}) as Record<string, unknown>;

    // 9. Generate PDF via file service — no storage upload
    const buffer = await this.fileServiceClient.generateLoa({
      html_content: template.htmlContent,
      header_html: (layoutConfig['headerHtml'] as string) ?? '',
      footer_html: (layoutConfig['footerHtml'] as string) ?? '',
      page_size: (layoutConfig['pageSize'] as string) ?? 'A4',
      margins: (layoutConfig['margins'] as { top: number; right: number; bottom: number; left: number }) ?? {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40,
      },
      placeholder_data: placeholderData,
      document_number: docNumber,
    });

    // 10. Record download tracking
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
