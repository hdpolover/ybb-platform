import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

export class GetLoaStatusQuery {
  constructor(
    public readonly templateId: string,
    public readonly programId: string,
  ) {}
}

export interface LoaStatusRow {
  documentId: string;
  participantId: string;
  participantName: string;
  email: string;
  documentNumber: string | null;
  generatedAt: Date;
  emailedAt: Date | null;
  fileUrl: string;
  status: 'generated' | 'emailed';
}

@Injectable()
@QueryHandler(GetLoaStatusQuery)
export class GetLoaStatusHandler implements IQueryHandler<GetLoaStatusQuery, LoaStatusRow[]> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetLoaStatusQuery): Promise<LoaStatusRow[]> {
    const docs = await this.prisma.participantDocument.findMany({
      where: {
        templateId: query.templateId,
        deletedAt: null,
        application: { programId: query.programId },
      },
      include: {
        application: {
          include: {
            participant: {
              select: {
                id: true,
                fullName: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });

    return docs.map((doc) => ({
      documentId: doc.id,
      participantId: doc.application.participant.id,
      participantName: doc.application.participant.fullName,
      email: doc.application.participant.user.email,
      documentNumber: doc.documentNumber,
      generatedAt: doc.generatedAt,
      emailedAt: doc.emailedAt,
      fileUrl: doc.fileUrl,
      status: doc.emailedAt != null ? 'emailed' : 'generated',
    }));
  }
}
