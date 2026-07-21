import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { parseProgramBatch } from '@shared/utils/parse-program-batch';
import {
  resolveLoaSignature,
  buildLoaSourceMap,
  buildGenerateLoaParams,
  LoaLayoutConfigInput,
} from '@shared/utils/loa-render-payload.util';

// Clearly-fake sample participant used for admin template previews — never a
// real person. Program fields (name/year/location/dates/theme/brand) are the
// REAL program's, so the preview reads as close to the eventual real letter
// as possible while staying honest that no participant has actually applied.
const SAMPLE_PARTICIPANT = {
  fullName: 'Jane Doe',
  participationCategoryName: 'International Delegate',
  institution: 'State University of Jakarta',
  nationality: 'Indonesian',
  birthdate: '12 May 2002',
  gender: 'Female',
  originCountry: 'Indonesia',
  email: 'jane.doe@example.com',
  phone: '+62 812345678',
  major: 'International Relations',
  occupation: 'Student',
};
const SAMPLE_DOCUMENT_NUMBER = 'PREVIEW-0000';

export class PreviewLoaTemplateQuery {
  constructor(
    public readonly programId: string,
    public readonly htmlContent: string,
    public readonly layoutConfig: Record<string, unknown>,
    public readonly placeholders: Array<{ key: string; source: string }>,
  ) {}
}

@QueryHandler(PreviewLoaTemplateQuery)
export class PreviewLoaTemplateHandler implements IQueryHandler<PreviewLoaTemplateQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  async execute(query: PreviewLoaTemplateQuery): Promise<Buffer> {
    const program = await this.prisma.program.findUnique({
      where: { id: query.programId },
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

    const layoutConfig = query.layoutConfig ?? {};
    const headerConfig = (layoutConfig['header'] as Record<string, unknown> | undefined) ?? undefined;

    // Same signature-resolution path as a real download — an admin previewing
    // an unsaved draft still sees exactly what a saved signatureId resolves to.
    const { signatureUrl, signerName, signerTitle } = await resolveLoaSignature(this.prisma, {
      signatureUrl: layoutConfig['signatureUrl'] as string | undefined,
      signatureId: layoutConfig['signatureId'] as string | undefined,
    });

    const now = new Date();
    const generatedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const startDate = program.startDate
      ? program.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const endDate = program.endDate
      ? program.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const { displayName: programDisplayName, batch: programBatch } = parseProgramBatch(program.name);

    const sourceMap = buildLoaSourceMap({
      participantFullName: SAMPLE_PARTICIPANT.fullName,
      programName: program.name,
      programBatch,
      generatedAt,
      documentNumber: SAMPLE_DOCUMENT_NUMBER,
      participationCategoryName: SAMPLE_PARTICIPANT.participationCategoryName,
      programLocation: program.location ?? '',
      programStartDate: startDate,
      programEndDate: endDate,
      institution: SAMPLE_PARTICIPANT.institution,
      nationality: SAMPLE_PARTICIPANT.nationality,
      birthdate: SAMPLE_PARTICIPANT.birthdate,
      gender: SAMPLE_PARTICIPANT.gender,
      originCountry: SAMPLE_PARTICIPANT.originCountry,
      signerName,
      signerTitle,
      programYear: String(program.year),
      participantEmail: SAMPLE_PARTICIPANT.email,
      participantPhone: SAMPLE_PARTICIPANT.phone,
      major: SAMPLE_PARTICIPANT.major,
      occupation: SAMPLE_PARTICIPANT.occupation,
      programTheme: program.theme ?? '',
      brandName: program.brand?.name ?? '',
    });

    const resolvedLayoutConfig: LoaLayoutConfigInput = {
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

    return this.fileServiceClient.generateLoa(
      buildGenerateLoaParams({
        htmlContent: query.htmlContent,
        layoutConfig: resolvedLayoutConfig,
        placeholders: query.placeholders ?? [],
        sourceMap,
        documentNumber: SAMPLE_DOCUMENT_NUMBER,
        signatureUrl,
        signerName,
        signerTitle,
        programDisplayName,
        programBatch,
      }),
    );
  }
}
