import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { MarkDocumentViewedCommand } from './mark-document-viewed.command';

export interface MarkDocumentViewedResult {
  viewedAt: Date | null;
}

@Injectable()
@CommandHandler(MarkDocumentViewedCommand)
export class MarkDocumentViewedHandler
  implements ICommandHandler<MarkDocumentViewedCommand, MarkDocumentViewedResult>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: MarkDocumentViewedCommand): Promise<MarkDocumentViewedResult> {
    const { userId, documentId } = command;

    const participant = await this.prisma.participant.findFirst({
      where: { userId },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    const doc = await this.prisma.participantDocument.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        application: { participantId: participant.id },
      },
      select: { id: true, viewedAt: true },
    });

    if (!doc) throw new NotFoundException('Document not found');

    // First-view-wins: if already viewed, return the existing timestamp
    if (doc.viewedAt !== null) {
      return { viewedAt: doc.viewedAt };
    }

    const updated = await this.prisma.participantDocument.update({
      where: { id: doc.id },
      data: { viewedAt: new Date() },
      select: { viewedAt: true },
    });

    return { viewedAt: updated.viewedAt };
  }
}
