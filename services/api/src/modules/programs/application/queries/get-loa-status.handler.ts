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
  participantId: string;
  participantName: string;
  email: string;
  applicationStatus: 'submitted' | 'accepted';
  status: 'pending' | 'generated' | 'emailed' | 'viewed';
  documentId: string | null;
  documentNumber: string | null;
  fileUrl: string | null;
  generatedAt: string | null;
  emailedAt: string | null;
  viewedAt: string | null;
}

@Injectable()
@QueryHandler(GetLoaStatusQuery)
export class GetLoaStatusHandler implements IQueryHandler<GetLoaStatusQuery, LoaStatusRow[]> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetLoaStatusQuery): Promise<LoaStatusRow[]> {
    // Fetch eligible applications (submitted + accepted) in bulk, with participant included
    const applications = await this.prisma.participantApplication.findMany({
      where: {
        programId: query.programId,
        status: { in: ['submitted', 'accepted'] },
        deletedAt: null,
      },
      include: {
        participant: {
          select: {
            id: true,
            fullName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { participant: { fullName: 'asc' } },
    });

    // Fetch all LOA documents for this template+program in one query (avoid N+1)
    const docs = await this.prisma.participantDocument.findMany({
      where: {
        templateId: query.templateId,
        deletedAt: null,
        application: { programId: query.programId },
      },
      select: {
        id: true,
        applicationId: true,
        documentNumber: true,
        fileUrl: true,
        generatedAt: true,
        emailedAt: true,
        viewedAt: true,
      },
      // asc so the Map's overwrite-last semantics keep the newest doc per application
      orderBy: { generatedAt: 'asc' },
    });

    // Build a map from applicationId -> document for O(1) join in memory
    const docByApplicationId = new Map(docs.map((d) => [d.applicationId, d]));

    return applications.map((app) => {
      const doc = docByApplicationId.get(app.id) ?? null;

      const status: LoaStatusRow['status'] = doc == null
        ? 'pending'
        : doc.viewedAt != null
          ? 'viewed'
          : doc.emailedAt != null
            ? 'emailed'
            : 'generated';

      return {
        participantId: app.participant.id,
        participantName: app.participant.fullName,
        email: app.participant.user.email,
        applicationStatus: app.status as 'submitted' | 'accepted',
        status,
        documentId: doc?.id ?? null,
        documentNumber: doc?.documentNumber ?? null,
        fileUrl: doc?.fileUrl ?? null,
        generatedAt: doc?.generatedAt?.toISOString() ?? null,
        emailedAt: doc?.emailedAt?.toISOString() ?? null,
        viewedAt: doc?.viewedAt?.toISOString() ?? null,
      };
    });
  }
}
