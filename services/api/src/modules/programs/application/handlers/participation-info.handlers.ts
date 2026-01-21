import { CommandHandler, ICommandHandler, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UpsertParticipationInfoCommand, DeleteParticipationInfoCommand } from '../commands/participation-info.commands';
import { GetParticipationInfoQuery, ListParticipationInfoQuery } from '../queries/participation-info.queries';

@CommandHandler(UpsertParticipationInfoCommand)
export class UpsertParticipationInfoHandler implements ICommandHandler<UpsertParticipationInfoCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpsertParticipationInfoCommand) {
    const { programId, dto } = command;

    // Check if program exists
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found');

    // Upsert
    return this.prisma.programParticipationInfo.upsert({
      where: {
        programId_category: {
          programId,
          category: dto.category,
        },
      },
      update: {
        ...dto,
      },
      create: {
        programId,
        ...dto,
      },
    });
  }
}

@CommandHandler(DeleteParticipationInfoCommand)
export class DeleteParticipationInfoHandler implements ICommandHandler<DeleteParticipationInfoCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteParticipationInfoCommand) {
    const { infoId } = command;
    try {
      return await this.prisma.programParticipationInfo.delete({ where: { id: infoId } });
    } catch (e) {
      throw new NotFoundException('Participation Info not found');
    }
  }
}

@QueryHandler(GetParticipationInfoQuery)
export class GetParticipationInfoHandler implements IQueryHandler<GetParticipationInfoQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetParticipationInfoQuery) {
    const { programId, category } = query;
    return this.prisma.programParticipationInfo.findUnique({
      where: {
        programId_category: {
          programId,
          category,
        },
      },
    });
  }
}

@QueryHandler(ListParticipationInfoQuery)
export class ListParticipationInfoHandler implements IQueryHandler<ListParticipationInfoQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListParticipationInfoQuery) {
    const { programId } = query;
    return this.prisma.programParticipationInfo.findMany({
      where: { programId },
    });
  }
}
