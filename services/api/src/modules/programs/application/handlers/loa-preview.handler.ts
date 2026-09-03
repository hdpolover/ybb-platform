import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { parseProgramBatch } from '@shared/utils/parse-program-batch';
import {
  resolveLoaSignature,
  buildLoaSourceMap,
  buildGenerateLoaParams,
  resolveLoaLayoutConfig,
} from '@shared/utils/loa-render-payload.util';
import { LoaRenderDataService } from '@modules/portal/application/services/loa-render-data.service';
import { LoaPreviewParticipantService, PREVIEW_DOCUMENT_NUMBER } from '../services/loa-preview-participant.service';
import { assertProgramContentAccess } from '../utils/program-content-access.util';

// Same shape as resolveProgramId() in loa-batch.handlers.ts. This route's :id
// is reached from the same admin pages (LoaTemplateEditor via
// useResolvedProgramId), which falls back to the raw route value - a program
// SLUG - whenever the program isn't in the caller's accessiblePrograms. That
// is the normal steady state for a program-scoped admin on their own page,
// not a first-paint race, so it must be resolved before any scope check or
// participant lookup, not assumed to already be a UUID.
async function resolveProgramId(
  repo: IProgramRepository,
  identifier: string,
): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (isUUID) return identifier;

  const program = await repo.findBySlug(identifier);
  return program ? program.id : null;
}

// Clearly-fake sample participant used for admin template previews. Never a
// real person. Program fields (name/year/location/dates/theme/brand) are the
// REAL program's, so the preview reads as close to the eventual real letter
// as possible while staying honest that no participant has actually applied.
// Only rendered when the program's pool of submitted/accepted applications is
// empty - see LoaPreviewParticipantService.resolveApplicationId.
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

export class PreviewLoaTemplateQuery {
  constructor(
    public readonly programId: string,
    public readonly htmlContent: string,
    public readonly layoutConfig: Record<string, unknown>,
    public readonly placeholders: Array<{ key: string; source: string }>,
    // The caller, so the handler can refuse a programme their scope does not
    // cover before reading any participant data.
    public readonly actor: CurrentUserData,
    public readonly applicationId?: string,
    public readonly source: 'draft' | 'saved' = 'draft',
  ) {}
}

export interface PreviewLoaResult {
  buffer: Buffer;
  participantName: string;
  isSample: boolean;
  // Which application was actually resolved and rendered - null when
  // isSample. Reported back to the caller (see program-content.controller.ts
  // X-Preview-Application-Id) so a caller that fired an auto-pick request can
  // pin the result instead of re-auto-picking on every subsequent call.
  applicationId: string | null;
}

@QueryHandler(PreviewLoaTemplateQuery)
export class PreviewLoaTemplateHandler implements IQueryHandler<PreviewLoaTemplateQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileServiceClient: FileServiceClient,
    private readonly loaRenderDataService: LoaRenderDataService,
    private readonly loaPreviewParticipantService: LoaPreviewParticipantService,
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly prismaRead: PrismaReadService,
  ) {}

  async execute(query: PreviewLoaTemplateQuery): Promise<PreviewLoaResult> {
    // Resolve id-or-slug and assert scope BEFORE any participant data (or even
    // program metadata) is read. This route was @Roles-gated but otherwise
    // unscoped: any admin/super_admin-role caller could preview any
    // programme's Invitation Letter with a REAL applicant's name, institution,
    // nationality, birthdate, gender, email and phone by passing an arbitrary
    // programId - the same defect class as the rest of this controller, just
    // reached by a render action instead of a CRUD write.
    const programId = await resolveProgramId(this.programRepository, query.programId);
    if (!programId) throw new NotFoundException('Program not found');
    await assertProgramContentAccess(this.prismaRead, query.actor, programId);

    const program = await this.prisma.program.findUnique({
      where: { id: programId },
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

    // Resolve which template content to render: the in-editor draft (request
    // body, default) or the persisted saved row. Never a third source.
    let htmlContent = query.htmlContent;
    let placeholders = query.placeholders ?? [];
    let layoutConfig = query.layoutConfig ?? {};
    if (query.source === 'saved') {
      const savedTemplate = await this.prisma.documentTemplate.findFirst({
        where: { programId, type: 'letter_of_acceptance', isActive: true, deletedAt: null },
        select: { htmlContent: true, placeholders: true, layoutConfig: true },
      });
      if (!savedTemplate || !savedTemplate.htmlContent) {
        throw new ConflictException('This Invitation Letter template is not published yet');
      }
      htmlContent = savedTemplate.htmlContent;
      placeholders = (savedTemplate.placeholders ?? []) as Array<{ key: string; source: string }>;
      layoutConfig = (savedTemplate.layoutConfig ?? {}) as Record<string, unknown>;
    }

    // Same signature-resolution path as a real download - an admin previewing
    // an unsaved draft still sees exactly what a saved signatureId resolves to.
    const { signatureUrl, signerName, signerTitle } = await resolveLoaSignature(this.prisma, {
      signatureUrl: layoutConfig['signatureUrl'] as string | undefined,
      signatureId: layoutConfig['signatureId'] as string | undefined,
    });

    // Shared with LoaDownloadService - see resolveLoaLayoutConfig for why.
    const resolvedLayoutConfig = resolveLoaLayoutConfig(layoutConfig);

    // Resolve who to preview as: explicit applicationId (validated against
    // this program - 404 if wrong/missing, never silently auto-picked
    // instead), auto-picked first submitted/accepted application, or
    // SAMPLE_PARTICIPANT when the pool is empty. LoaDocumentNumberService is
    // deliberately not injected into this handler at all - preview can never
    // allocate a real document number.
    const resolved = await this.loaPreviewParticipantService.resolveApplicationId(
      programId,
      query.applicationId,
    );

    let sourceMap: Record<string, string>;
    let programDisplayName: string;
    let programBatch: string;
    let documentNumber: string;
    let participantName: string;

    if (resolved.isSample) {
      documentNumber = PREVIEW_DOCUMENT_NUMBER;
      participantName = SAMPLE_PARTICIPANT.fullName;
      const now = new Date();
      const generatedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const startDate = program.startDate
        ? program.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      const endDate = program.endDate
        ? program.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      const split = parseProgramBatch(program.name);
      programDisplayName = split.displayName;
      programBatch = split.batch;
      sourceMap = buildLoaSourceMap({
        participantFullName: SAMPLE_PARTICIPANT.fullName,
        programName: program.name,
        programBatch,
        generatedAt,
        documentNumber,
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
    } else {
      documentNumber = await this.loaPreviewParticipantService.resolveDocumentNumber(resolved.applicationId);
      const renderData = await this.loaRenderDataService.buildSourceMapForApplication(resolved.applicationId, {
        documentNumber,
        signerName,
        signerTitle,
      });
      sourceMap = renderData.sourceMap;
      programDisplayName = renderData.programDisplayName;
      programBatch = renderData.programBatch;
      participantName = renderData.sourceMap['participant.fullName'];
    }

    const buffer = await this.fileServiceClient.generateLoa(
      buildGenerateLoaParams({
        htmlContent,
        layoutConfig: resolvedLayoutConfig,
        placeholders,
        sourceMap,
        documentNumber,
        signatureUrl,
        signerName,
        signerTitle,
        programDisplayName,
        programBatch,
      }),
    );

    return {
      buffer,
      participantName,
      isSample: resolved.isSample,
      applicationId: resolved.isSample ? null : resolved.applicationId,
    };
  }
}
