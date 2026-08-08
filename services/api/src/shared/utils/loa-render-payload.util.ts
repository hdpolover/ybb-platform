import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { GenerateLoaParams } from '@modules/files/infrastructure/clients/file-service.client';

// Shared assembly logic for the file-service `generateLoa()` payload — the
// exact same shape LoaDownloadService uses for real participant downloads
// and the admin template-preview handler uses for sample-data previews.
// Extracted so the two call sites can never drift out of sync the way the
// admin preview's old hand-rolled HTML mock did.

export interface LoaLayoutConfigInput {
  headerHtml?: string;
  footerHtml?: string;
  pageSize?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  logoUrl?: string;
  stampUrl?: string;
  footerNote?: string;
  showGeneratedDate?: boolean;
  header?: {
    tagline?: string;
    website?: string;
    email?: string;
    phone?: string;
  };
}

/**
 * Cast a persisted/request `layoutConfig` blob (`Record<string, unknown>`,
 * since it comes from a Prisma Json column or an untyped request DTO) into
 * `LoaLayoutConfigInput`. This was previously duplicated field-by-field in
 * both LoaDownloadService and PreviewLoaTemplateHandler - exactly the seam a
 * production Invitation Letter shipped with unsubstituted `{{token}}`s
 * through, because the two copies could silently drift. Extracted so both
 * callers share one cast and can never diverge again.
 */
export function resolveLoaLayoutConfig(layoutConfig: Record<string, unknown>): LoaLayoutConfigInput {
  const headerConfig = (layoutConfig['header'] as Record<string, unknown> | undefined) ?? undefined;
  return {
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
  };
}

export interface LoaSignatureConfigInput {
  signatureUrl?: string;
  signatureId?: string;
}

export interface ResolvedLoaSignature {
  signatureUrl: string;
  signerName: string;
  signerTitle: string;
}

/**
 * Resolve the signature to render: a `signatureId` (brand-scoped, reusable
 * Signature record) supersedes the legacy `signatureUrl` + blank name/title.
 * Any lookup failure (missing id, deleted row, DB error) degrades gracefully
 * back to the legacy fallback — mirrors LoaDownloadService step 7b exactly.
 */
export async function resolveLoaSignature(
  prisma: PrismaService,
  layoutConfig: LoaSignatureConfigInput,
): Promise<ResolvedLoaSignature> {
  let signatureUrl = layoutConfig.signatureUrl ?? '';
  let signerName = '';
  let signerTitle = '';
  const signatureId = layoutConfig.signatureId;
  if (signatureId) {
    try {
      const signature = await prisma.signature.findFirst({
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
  return { signatureUrl, signerName, signerTitle };
}

// Flat source-map fields keyed by the placeholder `source` strings referenced
// in DocumentTemplate.placeholders (see PLACEHOLDER_TOKENS in
// LoaTemplateEditor.tsx). Real downloads populate these from participant/
// program rows; preview populates them from clearly-fake sample data.
export interface LoaSourceMapFields {
  participantFullName: string;
  programName: string;
  programBatch: string;
  generatedAt: string;
  documentNumber: string;
  participationCategoryName: string;
  programLocation: string;
  programStartDate: string;
  programEndDate: string;
  institution: string;
  nationality: string;
  birthdate: string;
  gender: string;
  originCountry: string;
  signerName: string;
  signerTitle: string;
  programYear: string;
  participantEmail: string;
  participantPhone: string;
  major: string;
  occupation: string;
  programTheme: string;
  brandName: string;
}

export function buildLoaSourceMap(fields: LoaSourceMapFields): Record<string, string> {
  return {
    'participant.fullName': fields.participantFullName,
    'program.name': fields.programName,
    'program.batch': fields.programBatch,
    generated_at: fields.generatedAt,
    'participant_document.documentNumber': fields.documentNumber,
    'application.participationCategory.name': fields.participationCategoryName,
    'program.location': fields.programLocation,
    'program.startDate': fields.programStartDate,
    'program.endDate': fields.programEndDate,
    'participant.institution': fields.institution,
    'participant.nationality': fields.nationality,
    'participant.birthdate': fields.birthdate,
    'participant.gender': fields.gender,
    'participant.originCountry': fields.originCountry,
    signer_name: fields.signerName,
    signer_title: fields.signerTitle,
    'program.year': fields.programYear,
    'participant.email': fields.participantEmail,
    'participant.phone': fields.participantPhone,
    'participant.major': fields.major,
    'participant.occupation': fields.occupation,
    'program.theme': fields.programTheme,
    'brand.name': fields.brandName,
  };
}

export function buildLoaPlaceholderData(
  placeholders: Array<{ key: string; source: string }>,
  sourceMap: Record<string, string>,
  documentNumber: string,
  signerName: string,
  signerTitle: string,
): Record<string, string> {
  const placeholderData: Record<string, string> = {};
  for (const p of placeholders) {
    placeholderData[p.key] = sourceMap[p.source] ?? '';
  }
  // Always include these three even if not listed in the placeholders array —
  // footerHtml/headerHtml can reference them without a placeholders-array
  // mapping (mirrors LoaDownloadService step 8).
  placeholderData['{{document_number}}'] = documentNumber;
  placeholderData['{{signer_name}}'] = signerName;
  placeholderData['{{signer_title}}'] = signerTitle;
  return placeholderData;
}

export interface BuildGenerateLoaParamsInput {
  htmlContent: string;
  layoutConfig: LoaLayoutConfigInput;
  placeholders: Array<{ key: string; source: string }>;
  sourceMap: Record<string, string>;
  documentNumber: string;
  signatureUrl: string;
  signerName: string;
  signerTitle: string;
  /** Stripped display name (batch suffix removed) — see parseProgramBatch. */
  programDisplayName: string;
  programBatch: string;
}

/**
 * Build the exact params object sent to `fileServiceClient.generateLoa()`.
 * Mirrors LoaDownloadService step 9's field-by-field assembly precisely —
 * this IS that assembly, extracted so the preview endpoint calls the same
 * code instead of a hand-rolled duplicate.
 */
export function buildGenerateLoaParams(input: BuildGenerateLoaParamsInput): GenerateLoaParams {
  const {
    htmlContent,
    layoutConfig,
    placeholders,
    sourceMap,
    documentNumber,
    signatureUrl,
    signerName,
    signerTitle,
    programDisplayName,
    programBatch,
  } = input;

  const headerConfig = layoutConfig.header;
  const placeholderData = buildLoaPlaceholderData(placeholders, sourceMap, documentNumber, signerName, signerTitle);

  return {
    html_content: htmlContent,
    header_html: layoutConfig.headerHtml ?? '',
    footer_html: layoutConfig.footerHtml ?? '',
    page_size: layoutConfig.pageSize ?? 'A4',
    margins: layoutConfig.margins ?? { top: 40, right: 40, bottom: 40, left: 40 },
    placeholder_data: placeholderData,
    document_number: documentNumber,
    logo_url: layoutConfig.logoUrl ?? '',
    signature_url: signatureUrl,
    stamp_url: layoutConfig.stampUrl ?? '',
    signer_name: signerName,
    signer_title: signerTitle,
    header: headerConfig
      ? {
          program_name: programDisplayName,
          batch: programBatch,
          tagline: headerConfig.tagline ?? '',
          website: headerConfig.website ?? '',
          email: headerConfig.email ?? '',
          phone: headerConfig.phone ?? '',
        }
      : undefined,
    footer_note: layoutConfig.footerNote ?? '',
    show_generated_date: Boolean(layoutConfig.showGeneratedDate),
    // Always sent regardless of whether `header` above is configured — the
    // page-footer disclaimer's "{program} • Generated on ..." line needs it
    // independently of letterhead rendering.
    program_name: programDisplayName,
  };
}
