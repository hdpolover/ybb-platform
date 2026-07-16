import { BadRequestException } from '@nestjs/common';
import { ApplicationCategory, Participant, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

const AUTH_TARGET_PROGRAM_SELECT = {
  id: true,
  brandId: true,
  name: true,
  slug: true,
  year: true,
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
};

type EnsureProgramApplicationResult =
  | { status: 'missing_target' }
  | { status: 'closed'; program: AuthTargetProgram }
  | { status: 'existing'; program: AuthTargetProgram }
  | { status: 'created'; program: AuthTargetProgram };

function buildOpenRegistrationFilter(now: Date): Prisma.ProgramWhereInput {
  return {
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

export function isProgramRegistrationOpen(program: Pick<AuthTargetProgram, 'isActive' | 'allowRegistration' | 'isPublished' | 'registrationOpenDate' | 'registrationCloseDate'>, now: Date = new Date()): boolean {
  return (
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

  return prisma.program.findFirst({
    where: {
      brandId,
      ...buildOpenRegistrationFilter(now),
    },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    select: AUTH_TARGET_PROGRAM_SELECT,
  });
}

export async function ensureParticipantExists(
  prisma: PrismaService,
  userId: string,
  email: string,
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
      fullName: email.split('@')[0],
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
    const isAvailable = participationInfos.some(
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

  await prisma.participantApplication.create({
    data: {
      participantId: params.participantId,
      programId: targetProgram.id,
      status: 'draft',
      applicationCategory,
    },
  });

  return { status: 'created', program: targetProgram };
}