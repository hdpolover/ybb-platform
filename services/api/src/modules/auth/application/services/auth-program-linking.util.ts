import { BadRequestException } from '@nestjs/common';
import { ApplicationCategory, Participant, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MetaCapiService } from '../../../meta/meta-capi.service';
import { parseAdAttribution } from './ad-attribution.util';

const AUTH_TARGET_PROGRAM_SELECT = {
  id: true,
  brandId: true,
  name: true,
  slug: true,
  year: true,
  status: true,
  isPublished: true,
  isActive: true,
  allowRegistration: true,
  registrationOpenDate: true,
  registrationCloseDate: true,
  startDate: true,
  createdAt: true,
  requireEmailVerification: true,
} satisfies Prisma.ProgramSelect;

type AuthTargetProgram = Prisma.ProgramGetPayload<{
  select: typeof AUTH_TARGET_PROGRAM_SELECT;
}>;

type ResolveAuthTargetProgramParams = {
  brandId: string;
  programId?: string;
  programSlug?: string;
  fallbackToLatestOpenProgram?: boolean;
};

type EnsureProgramApplicationParams = {
  participantId: string;
  brandId: string;
  programId?: string;
  programSlug?: string;
  applicationCategory?: ApplicationCategory;
  fallbackToLatestOpenProgram?: boolean;
  // Conversion-tracking twin of an `ApplicationCreated` pixel fire from the
  // frontend — see the emit call at the bottom of this function for why it's
  // passed in here rather than injected: this file is a set of plain
  // functions (no DI container), called from three different @Injectable
  // command handlers, each of which already has MetaCapiService available
  // via AuthModule's global registration of MetaModule.
  metaCapiService?: MetaCapiService;
  userEmail?: string;
  userId?: string;
};

type EnsureProgramApplicationResult =
  | { status: 'missing_target' }
  | { status: 'closed'; program: AuthTargetProgram }
  | { status: 'existing'; program: AuthTargetProgram }
  | { status: 'created'; program: AuthTargetProgram; applicationId: string };

/**
 * Auth-response-facing view of a program-linking outcome that the client needs
 * to surface to the user (e.g. "registration for X has closed") AND to sync its
 * client-side active-program selector to (see ybb_active_program_id in
 * ybb-program-next/lib/dashboard/activeProgram.ts). 'created' and 'existing'
 * both carry a real programId a participant just authenticated against, so the
 * frontend can pin its selector to it before the stale localStorage value
 * (from an earlier session on a different program) wins by default.
 * 'missing_target' covers both "no program was requested" (the common case)
 * and "fallback found nothing open", which are indistinguishable and not
 * worth surfacing.
 */
export type ProgramRegistrationInfo = {
  status: 'closed' | 'existing' | 'created';
  programId: string;
  programName: string;
};

export function toProgramRegistrationInfo(
  result: EnsureProgramApplicationResult,
): ProgramRegistrationInfo | undefined {
  if (result.status === 'missing_target') {
    return undefined;
  }

  return {
    status: result.status,
    programId: result.program.id,
    programName: result.program.name,
  };
}

const PUBLISHED_PROGRAM_STATUS = 'published';

/**
 * `status` is the field admins actually set in the dashboard; `isPublished` and
 * `isActive` are independent flags that default to false/true and can be
 * toggled without touching it. A program left at status 'draft' with those
 * flags on is not a registration target, so it has to be filtered here too.
 */
function buildOpenRegistrationFilter(now: Date): Prisma.ProgramWhereInput {
  return {
    status: PUBLISHED_PROGRAM_STATUS,
    isPublished: true,
    isActive: true,
    allowRegistration: true,
    AND: [
      {
        OR: [{ registrationOpenDate: null }, { registrationOpenDate: { lte: now } }],
      },
      {
        OR: [{ registrationCloseDate: null }, { registrationCloseDate: { gte: now } }],
      },
    ],
  };
}

export function isProgramRegistrationOpen(program: Pick<AuthTargetProgram, 'status' | 'isActive' | 'allowRegistration' | 'isPublished' | 'registrationOpenDate' | 'registrationCloseDate'>, now: Date = new Date()): boolean {
  return (
    program.status === PUBLISHED_PROGRAM_STATUS &&
    program.isPublished &&
    program.isActive &&
    program.allowRegistration &&
    (!program.registrationOpenDate || program.registrationOpenDate <= now) &&
    (!program.registrationCloseDate || program.registrationCloseDate >= now)
  );
}

export async function resolveAuthTargetProgram(
  prisma: PrismaService,
  params: ResolveAuthTargetProgramParams,
): Promise<AuthTargetProgram | null> {
  const { brandId, programId, programSlug, fallbackToLatestOpenProgram = false } = params;
  const now = new Date();

  if (programId) {
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: AUTH_TARGET_PROGRAM_SELECT,
    });

    if (!program || program.brandId !== brandId) {
      throw new BadRequestException('Program does not belong to the selected brand');
    }

    return program;
  }

  if (programSlug) {
    const program = await prisma.program.findUnique({
      where: {
        brandId_slug: {
          brandId,
          slug: programSlug,
        },
      },
      select: AUTH_TARGET_PROGRAM_SELECT,
    });

    if (!program) {
      throw new BadRequestException(`Invalid program slug '${programSlug}' for the current brand.`);
    }

    return program;
  }

  if (!fallbackToLatestOpenProgram) {
    return null;
  }

  const openPrograms = await prisma.program.findMany({
    where: {
      brandId,
      ...buildOpenRegistrationFilter(now),
    },
    select: AUTH_TARGET_PROGRAM_SELECT,
  });

  return pickPrimaryRegistrationProgram(openPrograms);
}

/**
 * Null registration dates mean "unrestricted", so a brand's next-season program
 * passes the open-registration filter the moment it is published, and ordering
 * by startDate alone hands it every signup while the season actually taking
 * applications sorts second. Rank a deliberately configured registration window
 * above an unconfigured one first, and only then fall back to the later start.
 */
function pickPrimaryRegistrationProgram(
  programs: AuthTargetProgram[],
): AuthTargetProgram | null {
  const windowSpecificity = (program: AuthTargetProgram): number =>
    (program.registrationOpenDate ? 1 : 0) + (program.registrationCloseDate ? 1 : 0);

  return (
    [...programs].sort(
      (a, b) =>
        windowSpecificity(b) - windowSpecificity(a) ||
        b.startDate.getTime() - a.startDate.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0] ?? null
  );
}

export async function ensureParticipantExists(
  prisma: PrismaService,
  userId: string,
): Promise<Participant> {
  const existingParticipant = await prisma.participant.findUnique({
    where: { userId },
  });

  if (existingParticipant) {
    return existingParticipant;
  }

  return prisma.participant.create({
    data: {
      userId,
      // Blank until onboarding collects a real name. The email local part is
      // not a valid name (@IsEnglishName forbids digits) and the onboarding
      // form prefills from this column, so seeding it deadlocks the submit.
      fullName: '',
    },
  });
}

export async function ensureProgramApplication(
  prisma: PrismaService,
  params: EnsureProgramApplicationParams,
): Promise<EnsureProgramApplicationResult> {
  const targetProgram = await resolveAuthTargetProgram(prisma, {
    brandId: params.brandId,
    programId: params.programId,
    programSlug: params.programSlug,
    fallbackToLatestOpenProgram: params.fallbackToLatestOpenProgram,
  });

  if (!targetProgram) {
    return { status: 'missing_target' };
  }

  const existingApplication = await prisma.participantApplication.findUnique({
    where: {
      participantId_programId: {
        participantId: params.participantId,
        programId: targetProgram.id,
      },
    },
  });

  if (existingApplication) {
    return { status: 'existing', program: targetProgram };
  }

  if (!isProgramRegistrationOpen(targetProgram)) {
    return { status: 'closed', program: targetProgram };
  }

  const participationInfos = await prisma.programParticipationInfo.findMany({
    where: {
      programId: targetProgram.id,
      isActive: true,
    },
  });

  let applicationCategory: ApplicationCategory = ApplicationCategory.self_funded;

  if (params.applicationCategory) {
    // An empty list means no categories have been configured for this program,
    // not that every category is forbidden. Treating it as a whitelist rejected
    // every registration that named a category, and no published program
    // currently has any active participation info rows. The else branch below
    // already reads an empty list this way, falling back to a default rather
    // than failing, so this keeps the two halves consistent.
    const isAvailable =
      participationInfos.length === 0 ||
      participationInfos.some(
        (participationInfo) => participationInfo.category === params.applicationCategory,
      );

    if (!isAvailable) {
      throw new BadRequestException(
        `Registration for '${params.applicationCategory.replace('_', ' ')}' is not available for this program.`,
      );
    }

    applicationCategory = params.applicationCategory;
  } else {
    const hasFullyFunded = participationInfos.some(
      (participationInfo) => participationInfo.category === ApplicationCategory.fully_funded,
    );
    const hasSelfFunded = participationInfos.some(
      (participationInfo) => participationInfo.category === ApplicationCategory.self_funded,
    );

    if (hasFullyFunded) {
      applicationCategory = ApplicationCategory.fully_funded;
    } else if (hasSelfFunded) {
      applicationCategory = ApplicationCategory.self_funded;
    } else if (participationInfos.length > 0) {
      applicationCategory = participationInfos[0].category;
    }
  }

  const createdApplication = await prisma.participantApplication.create({
    data: {
      participantId: params.participantId,
      programId: targetProgram.id,
      status: 'draft',
      applicationCategory,
    },
    select: { id: true },
  });

  // Fire-and-forget `ApplicationCreated` conversion event (Layer 1b). Unlike
  // the other layers this one has NO browser twin, deliberately: the frontend
  // knows neither the application id nor the category the whitelist logic
  // below actually resolved, so firing it there would report a guess. The
  // `appcreated_<applicationId>` id is therefore a dedupe key against a
  // redelivered event, not against a pixel. customData reports the RESOLVED category
  // (which may differ from params.applicationCategory — see the whitelist
  // fallback logic above), because the whole point of tracking this
  // server-side is reporting what was actually written, not what was asked
  // for. Never awaited: a tracking failure must never fail account
  // registration/login, and emitServerEvent itself never throws.
  //
  // The participant's stored ad_attribution is fetched here (not passed in by
  // the caller) so a returning user's ApplicationCreated always replays the
  // click id captured at their ORIGINAL signup, even when this login request
  // itself carried no adAttribution — see participants.ad_attribution's
  // first-write-wins rule. Wrapped in its own async IIFE, never awaited, so
  // this extra lookup adds zero latency to registration/login.
  void (async () => {
    try {
      const stored = await prisma.participant.findUnique({
        where: { id: params.participantId },
        select: { adAttribution: true },
      });
      params.metaCapiService?.emitServerEvent({
        brandId: params.brandId,
        eventName: 'ApplicationCreated',
        eventId: `appcreated_${createdApplication.id}`,
        customData: { content_category: applicationCategory },
        userData: { email: params.userEmail, externalId: params.userId },
        ...parseAdAttribution(stored?.adAttribution),
      });
    } catch {
      // Best-effort only — a failed lookup here must never surface, and must
      // never block the caller (this IIFE is fired with `void`, never awaited).
    }
  })();

  return { status: 'created', program: targetProgram, applicationId: createdApplication.id };
}