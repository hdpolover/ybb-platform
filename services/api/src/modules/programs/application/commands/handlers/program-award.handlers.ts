// services/api/src/modules/programs/application/commands/handlers/program-award.handlers.ts
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ProgramAward } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { invalidateLandingCacheByProgramId } from './manage-program-content.handlers';
import {
  CreateProgramAwardCommand,
  DeleteProgramAwardCommand,
  ListProgramAwardsQuery,
  UpdateProgramAwardCommand,
} from '../program-award.commands';

// The route's programId is what AdminScopeGuard authorised, so an award id is
// only honoured when it belongs to that program. Missing and "not this
// program's" are the same 404 so the response is no cross-program oracle.
async function assertAwardInProgram(prisma: PrismaService, programId: string, awardId: string): Promise<void> {
  const award = await prisma.programAward.findFirst({
    where: { id: awardId, programId, deletedAt: null },
    select: { id: true },
  });
  if (!award) throw new NotFoundException('Award not found');
}

@QueryHandler(ListProgramAwardsQuery)
export class ListProgramAwardsHandler implements IQueryHandler<ListProgramAwardsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute({ programId }: ListProgramAwardsQuery): Promise<ProgramAward[]> {
    return this.prisma.programAward.findMany({
      where: { programId, deletedAt: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }
}

@CommandHandler(CreateProgramAwardCommand)
export class CreateProgramAwardHandler implements ICommandHandler<CreateProgramAwardCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async execute({ programId, dto }: CreateProgramAwardCommand): Promise<ProgramAward> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
    if (!program) throw new NotFoundException('Program not found');

    const award = await this.prisma.programAward.create({ data: { ...dto, programId } });
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);
    return award;
  }
}

@CommandHandler(UpdateProgramAwardCommand)
export class UpdateProgramAwardHandler implements ICommandHandler<UpdateProgramAwardCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async execute({ programId, awardId, dto }: UpdateProgramAwardCommand): Promise<ProgramAward> {
    await assertAwardInProgram(this.prisma, programId, awardId);
    const award = await this.prisma.programAward.update({ where: { id: awardId }, data: { ...dto } });
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);
    return award;
  }
}

@CommandHandler(DeleteProgramAwardCommand)
export class DeleteProgramAwardHandler implements ICommandHandler<DeleteProgramAwardCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async execute({ programId, awardId }: DeleteProgramAwardCommand): Promise<void> {
    await assertAwardInProgram(this.prisma, programId, awardId);
    await this.prisma.programAward.update({ where: { id: awardId }, data: { deletedAt: new Date() } });
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);
  }
}
