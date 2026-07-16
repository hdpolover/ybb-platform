import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { PortalCacheService } from './portal-cache.service';
import { parseProgramBatch } from '../utils/parse-program-batch';

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
    let signatureUrl = (layoutConfig['signatureUrl'] as string) ?? '';
    let signerName = '';
    let signerTitle = '';
    const signatureId = layoutConfig['signatureId'] as string | undefined;
    if (signatureId) {
      try {
        const signature = await this.prisma.signature.findFirst({
          where: { id: signatureId, deletedAt: null },
          select: { imageUrl: true, name: true, title: true },
        });
        if (signature) {
          signatureUrl = signature.imageUrl;
          signerName = signature.name;
          signerTitle = signature.title ?? '';
        }
      } catch {
        // Swallow — fall back to legacy layoutConfig.signatureUrl values above.
      }
    }

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
    const sourceMap: Record<string, string> = {
      'participant.fullName': application.participant.fullName,
      'program.name': program.name,
      'program.batch': programBatch,
      'generated_at': generatedAt,
      'participant_document.documentNumber': docNumber,
      'application.participationCategory.name': application.participationCategory?.name ?? '',
      'program.location': program.location ?? '',
      'program.startDate': startDate,
      'program.endDate': endDate,
      'participant.institution': application.participant.institution ?? '',
      'participant.nationality': application.participant.nationality ?? '',
      'participant.birthdate': birthdate,
      'participant.gender': formatGender(application.participant.gender),
      'participant.originCountry': application.participant.originCountry ?? '',
      'signer_name': signerName,
      'signer_title': signerTitle,
      'program.year': String(program.year),
      'participant.email': application.participant.user?.email ?? '',
      'participant.phone': formatPhone(application.participant.phoneCountryCode, application.participant.phoneNumber),
      'participant.major': application.participant.major ?? '',
      'participant.occupation': application.participant.occupation ?? '',
      'program.theme': program.theme ?? '',
      'brand.name': program.brand?.name ?? '',
    };

    const placeholders = (template.placeholders ?? []) as Array<{ key: string; source: string }>;
    const placeholderData: Record<string, string> = {};
    for (const p of placeholders) {
      placeholderData[p.key] = sourceMap[p.source] ?? '';
    }
    // Always include document_number token even if not listed in placeholders definition
    placeholderData['{{document_number}}'] = docNumber;

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
      logo_url: (layoutConfig['logoUrl'] as string) ?? '',
      signature_url: signatureUrl,
      stamp_url: (layoutConfig['stampUrl'] as string) ?? '',
      signer_name: signerName,
      signer_title: signerTitle,
      header: headerConfig
        ? {
            program_name: programDisplayName,
            batch: programBatch,
            tagline: (headerConfig['tagline'] as string) ?? '',
            website: (headerConfig['website'] as string) ?? '',
            email: (headerConfig['email'] as string) ?? '',
            phone: (headerConfig['phone'] as string) ?? '',
          }
        : undefined,
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
