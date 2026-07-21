import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { PortalCacheService } from './portal-cache.service';
import { parseProgramBatch } from '@shared/utils/parse-program-batch';
import {
  resolveLoaSignature,
  buildLoaSourceMap,
  buildGenerateLoaParams,
} from '@shared/utils/loa-render-payload.util';

// Gender enum values (prisma/schema/enums.prisma) are lowercase 'male' | 'female'.
// Rendered human-readable on the LOA for visa-support tokens.
function formatGender(gender: string | null | undefined): string {
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  return '';
}

// Joins phone country code + number sensibly — no double spaces, degrades to
// whichever half is present, empty string when neither is.
function formatPhone(countryCode: string | null | undefined, phoneNumber: string | null | undefined): string {
  const cc = countryCode?.trim();
  const num = phoneNumber?.trim();
  if (cc && num) return `${cc} ${num}`;
  return cc || num || '';
}

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

    // 2. Resolve the participant's application first (Bug 1 fix: invert resolution order).
    //    A brand can have >1 active program, so resolving program by brandId alone risks
    //    picking the wrong one. Instead we find the application and read programId from it.
    const application = await this.prisma.participantApplication.findFirst({
      where: { participantId: participant.id },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        programId: true,
        participant: {
          select: {
            fullName: true,
            institution: true,
            nationality: true,
            birthdate: true,
            gender: true,
            originCountry: true,
            phoneCountryCode: true,
            phoneNumber: true,
            major: true,
            occupation: true,
            user: { select: { email: true } },
          },
        },
        participationCategory: { select: { name: true } },
      },
    });
    if (!application) throw new ForbiddenException('Invitation Letter not available');

    // 3. Resolve the program deterministically from the application's own programId
    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: {
        id: true,
        name: true,
        year: true,
        startDate: true,
        endDate: true,
        location: true,
        programType: true,
        theme: true,
        brand: { select: { name: true } },
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    // 4. Eligibility gate
    const eligibility = await this.loaEligibilityService.checkEligibility(application.id, program.id);
    if (!eligibility.eligible) throw new ForbiddenException('Invitation Letter not available');

    // 5. Fetch the active LOA document template (moved before assignOrGet so we can pass
    //    its id to assignOrGet — Bug 2 fix: templateId must be set on the created row)
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

    // 7. Extract layout settings from layoutConfig (moved ahead of the placeholder map so
    //    signerName/signerTitle below are resolved before {{signer_name}}/{{signer_title}}
    //    are read into the source map)
    const layoutConfig = (template.layoutConfig ?? {}) as Record<string, unknown>;
    const headerConfig = (layoutConfig['header'] as Record<string, unknown> | undefined) ?? undefined;

    // 7b. Resolve signature — legacy fallback is raw layoutConfig.signatureUrl with
    // empty signer name/title (Stage 1 behavior). If layoutConfig.signatureId is set,
    // look up the reusable brand-scoped Signature record and supersede the legacy
    // values with its imageUrl/name/title. Any lookup failure (missing id, deleted
    // row, DB error) degrades gracefully back to the legacy fallback — a bad
    // signature reference must never break LOA download.
    const { signatureUrl, signerName, signerTitle } = await resolveLoaSignature(this.prisma, {
      signatureUrl: layoutConfig['signatureUrl'] as string | undefined,
      signatureId: layoutConfig['signatureId'] as string | undefined,
    });

    // 8. Build placeholder substitution map. Note: this source map used to be described
    //    as mirroring a `GenerateLOAHandler` — that handler was removed during the
    //    on-demand LOA rework (docs/superpowers/specs/2026-06-16-loa-on-demand-release-batches-design.md);
    //    this is now the only place that builds LOA placeholder data.
    const now = new Date();
    const generatedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const startDate = program.startDate
      ? program.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const endDate = program.endDate
      ? program.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const birthdate = application.participant.birthdate
      ? application.participant.birthdate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    // Header title uses the stripped display name + parsed batch (e.g. "Japan Youth
    // Summit 2026" / "Batch 2"); the {{program_name}} body token keeps resolving to the
    // full original program.name below — only the header rendering uses the split form.
    const { displayName: programDisplayName, batch: programBatch } = parseProgramBatch(program.name);
    const sourceMap = buildLoaSourceMap({
      participantFullName: application.participant.fullName,
      programName: program.name,
      programBatch,
      generatedAt,
      documentNumber: docNumber,
      participationCategoryName: application.participationCategory?.name ?? '',
      programLocation: program.location ?? '',
      programStartDate: startDate,
      programEndDate: endDate,
      institution: application.participant.institution ?? '',
      nationality: application.participant.nationality ?? '',
      birthdate,
      gender: formatGender(application.participant.gender),
      originCountry: application.participant.originCountry ?? '',
      signerName,
      signerTitle,
      programYear: String(program.year),
      participantEmail: application.participant.user?.email ?? '',
      participantPhone: formatPhone(application.participant.phoneCountryCode, application.participant.phoneNumber),
      major: application.participant.major ?? '',
      occupation: application.participant.occupation ?? '',
      programTheme: program.theme ?? '',
      brandName: program.brand?.name ?? '',
    });

    const placeholders = (template.placeholders ?? []) as Array<{ key: string; source: string }>;

    // 9. Generate PDF via file service — no storage upload
    const buffer = await this.fileServiceClient.generateLoa(
      buildGenerateLoaParams({
        htmlContent: template.htmlContent,
        layoutConfig: {
          headerHtml: layoutConfig['headerHtml'] as string | undefined,
          footerHtml: layoutConfig['footerHtml'] as string | undefined,
          pageSize: layoutConfig['pageSize'] as string | undefined,
          margins: layoutConfig['margins'] as { top: number; right: number; bottom: number; left: number } | undefined,
          logoUrl: layoutConfig['logoUrl'] as string | undefined,
          stampUrl: layoutConfig['stampUrl'] as string | undefined,
          footerNote: layoutConfig['footerNote'] as string | undefined,
          showGeneratedDate: layoutConfig['showGeneratedDate'] as boolean | undefined,
          header: headerConfig
            ? {
                tagline: headerConfig['tagline'] as string | undefined,
                website: headerConfig['website'] as string | undefined,
                email: headerConfig['email'] as string | undefined,
                phone: headerConfig['phone'] as string | undefined,
              }
            : undefined,
        },
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
