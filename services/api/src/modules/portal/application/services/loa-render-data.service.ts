import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { parseProgramBatch } from '@shared/utils/parse-program-batch';
import { buildLoaSourceMap } from '@shared/utils/loa-render-payload.util';

// Gender enum values (prisma/schema/enums.prisma) are lowercase 'male' | 'female'.
// Rendered human-readable on the LOA for visa-support tokens.
export function formatGender(gender: string | null | undefined): string {
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  return '';
}

// Joins phone country code + number sensibly. No double spaces, degrades to
// whichever half is present, empty string when neither is.
export function formatPhone(countryCode: string | null | undefined, phoneNumber: string | null | undefined): string {
  const cc = countryCode?.trim();
  const num = phoneNumber?.trim();
  if (cc && num) return `${cc} ${num}`;
  return cc || num || '';
}

// participants.institution/nationality/major/occupation are never populated on this
// platform (verified in prod: 0/13,199 participants have any of these set). The real
// values live in participant_applications.personal_data (JSON). Read from there first,
// falling back to the dead participant column so nothing regresses if personal_data is
// null or missing the key. A whitespace-only value counts as absent too.
export function readPersonalDataField(personalData: unknown, key: string, fallback: string | null | undefined): string {
  if (personalData && typeof personalData === 'object' && !Array.isArray(personalData)) {
    const value = (personalData as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return fallback ?? '';
}

export interface BuildSourceMapOptions {
  documentNumber: string;
  signerName: string;
  signerTitle: string;
}

export interface LoaRenderData {
  sourceMap: Record<string, string>;
  programDisplayName: string;
  programBatch: string;
}

/**
 * Builds the flat placeholder source map (and the header display-name/batch
 * split) for a given application. The single place that turns a participant
 * + program row pair into LOA template tokens.
 *
 * Used by both the real participant download (LoaDownloadService) and the
 * admin preview endpoint (PreviewLoaTemplateHandler, source: 'saved' | 'draft')
 * so the two paths can never diverge on what "real participant data" means.
 *
 * Deliberately excludes: eligibility, document-number assignment/persistence,
 * template content/placeholders, signature resolution. Every caller owns
 * those on its own, since they differ by call site (download always assigns
 * a document number, preview never does; download uses the persisted
 * template, preview may use an unsaved draft).
 */
@Injectable()
export class LoaRenderDataService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSourceMapForApplication(applicationId: string, opts: BuildSourceMapOptions): Promise<LoaRenderData> {
    const application = await this.prisma.participantApplication.findFirst({
      where: { id: applicationId },
      select: {
        id: true,
        programId: true,
        personalData: true,
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
    if (!application) throw new NotFoundException('Application not found');

    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: {
        id: true,
        name: true,
        year: true,
        startDate: true,
        endDate: true,
        location: true,
        theme: true,
        brand: { select: { name: true } },
      },
    });
    if (!program) throw new NotFoundException('Program not found');

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
    const { displayName: programDisplayName, batch: programBatch } = parseProgramBatch(program.name);

    const sourceMap = buildLoaSourceMap({
      participantFullName: application.participant.fullName,
      programName: program.name,
      programBatch,
      generatedAt,
      documentNumber: opts.documentNumber,
      participationCategoryName: application.participationCategory?.name ?? '',
      programLocation: program.location ?? '',
      programStartDate: startDate,
      programEndDate: endDate,
      institution: readPersonalDataField(application.personalData, 'institution', application.participant.institution),
      nationality: readPersonalDataField(application.personalData, 'nationality', application.participant.nationality),
      birthdate,
      gender: formatGender(application.participant.gender),
      originCountry: application.participant.originCountry ?? '',
      signerName: opts.signerName,
      signerTitle: opts.signerTitle,
      programYear: String(program.year),
      participantEmail: application.participant.user?.email ?? '',
      participantPhone: formatPhone(application.participant.phoneCountryCode, application.participant.phoneNumber),
      major: readPersonalDataField(application.personalData, 'major', application.participant.major),
      occupation: readPersonalDataField(application.personalData, 'occupation', application.participant.occupation),
      programTheme: program.theme ?? '',
      brandName: program.brand?.name ?? '',
    });

    return { sourceMap, programDisplayName, programBatch };
  }
}
