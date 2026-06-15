import { Injectable } from '@nestjs/common';
import {
  ParticipantApplication,
  ApplicationStatus,
  ApplicationCategory,
  ScoreStatus,
  DocumentFile,
  ApplicationStatusHistoryEntry,
} from '@core/entities/participant-application.entity';
import { ApplicationResponseDto } from '@modules/applications/application/dto/application-response.dto';
import { Prisma } from '@prisma/client';

/**
 * Application Mapper
 * 
 * Infrastructure Layer - Data Mapper
 * Transforms between domain entities and DTOs/Prisma models
 */
@Injectable()
export class ApplicationMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  toDomain(prismaModel: Prisma.ParticipantApplicationGetPayload<Record<string, never>>): ParticipantApplication {
    return new ParticipantApplication(
      prismaModel.id,
      prismaModel.participantId,
      prismaModel.programId,
      prismaModel.status as ApplicationStatus,
      prismaModel.applicationCategory as ApplicationCategory,
      // Map New JSON Fields — cast from Prisma's JsonValue to domain types
      (prismaModel.personalData ?? {}) as Record<string, unknown>,
      (prismaModel.essayAnswers ?? {}) as Record<string, unknown>,
      (prismaModel.uploadedFiles ?? {}) as unknown as Record<string, DocumentFile>,

      prismaModel.motivationLetter ?? undefined,
      prismaModel.achievements ?? undefined,
      prismaModel.experiences ?? undefined,
      (prismaModel.documentFiles ?? {}) as unknown as Record<string, DocumentFile>,
      (prismaModel.requirementFiles ?? []) as unknown as DocumentFile[],
      prismaModel.twibbonLink ?? undefined,
      prismaModel.pricingTierId ?? undefined,
      prismaModel.scoreTotal ? Number(prismaModel.scoreTotal) : undefined,
      (prismaModel.scoreBreakdown ?? {}) as Record<string, number>,
      prismaModel.scoreStatus as ScoreStatus ?? undefined,
      prismaModel.reviewedBy ?? undefined,
      prismaModel.reviewedAt ?? undefined,
      prismaModel.reviewerNotes ?? undefined,
      (prismaModel.participantSnapshot ?? {}) as Record<string, unknown>,
      (prismaModel.statusHistory ?? []) as unknown as ApplicationStatusHistoryEntry[],
      prismaModel.createdAt,
      prismaModel.updatedAt,
      prismaModel.submittedAt ?? undefined,
      prismaModel.lastEditedAt ?? undefined,
      prismaModel.withdrawnAt ?? undefined,
      prismaModel.withdrawnBy ?? undefined,
    );
  }

  /**
   * Convert Domain Entity to DTO
   */
  toDto(
    entity: ParticipantApplication,
    includeRelations: boolean = false,
  ): ApplicationResponseDto {
    const dto: ApplicationResponseDto = {
      id: entity.id,
      participantId: entity.participantId,
      programId: entity.programId,
      status: entity.status,
      applicationCategory: entity.applicationCategory,
      motivationLetter: entity.motivationLetter,
      achievements: entity.achievements,
      experiences: entity.experiences,
      documents: entity.documents,
      requirementFiles: entity.requirementFiles,
      twibbonLink: entity.twibbonLink,
      pricingTierId: entity.pricingTierId,
      scoreTotal: entity.scoreTotal,
      scoreBreakdown: entity.scoreBreakdown,
      scoreStatus: entity.scoreStatus,
      reviewedBy: entity.reviewedBy,
      reviewedAt: entity.reviewedAt,
      reviewerNotes: entity.reviewerNotes,
      participantSnapshot: entity.participantSnapshot,
      statusHistory: entity.statusHistory,
      createdAt: entity.createdAt!,
      updatedAt: entity.updatedAt!,
      submittedAt: entity.submittedAt,
      lastEditedAt: entity.lastEditedAt,
      withdrawnAt: entity.withdrawnAt,
      withdrawnBy: entity.withdrawnBy,
    };

    // TODO: If includeRelations is true, populate participant, program, reviewer
    // This would require additional repository queries or joins

    return dto;
  }

  /**
   * Convert Domain Entity to Prisma create input
   */
  toPrismaCreate(entity: ParticipantApplication): Record<string, unknown> {
    return {
      participantId: entity.participantId,
      programId: entity.programId,
      status: entity.status,
      applicationCategory: entity.applicationCategory,
      motivationLetter: entity.motivationLetter,
      achievements: entity.achievements,
      experiences: entity.experiences,
      documents: entity.documents || {},
      requirementFiles: entity.requirementFiles || [],
      twibbonLink: entity.twibbonLink,
      pricingTierId: entity.pricingTierId,
      scoreTotal: entity.scoreTotal,
      scoreBreakdown: entity.scoreBreakdown,
      scoreStatus: entity.scoreStatus,
      reviewedBy: entity.reviewedBy,
      reviewedAt: entity.reviewedAt,
      reviewerNotes: entity.reviewerNotes,
      participantSnapshot: entity.participantSnapshot,
      statusHistory: entity.statusHistory || [],
      submittedAt: entity.submittedAt,
      lastEditedAt: entity.lastEditedAt,
      withdrawnAt: entity.withdrawnAt,
      withdrawnBy: entity.withdrawnBy,
    };
  }

  /**
   * Convert Domain Entity to Prisma update input
   */
  toPrismaUpdate(entity: ParticipantApplication): Record<string, unknown> {
    return {
      status: entity.status,
      // Only write applicationCategory when the entity actually carries one.
      // Spreading it unconditionally let a null/undefined entity value overwrite
      // a real category in the DB with NULL (e.g. via the admin update path).
      ...(entity.applicationCategory != null
        ? { applicationCategory: entity.applicationCategory }
        : {}),
      motivationLetter: entity.motivationLetter,
      achievements: entity.achievements,
      experiences: entity.experiences,
      documents: entity.documents,
      requirementFiles: entity.requirementFiles,
      twibbonLink: entity.twibbonLink,
      pricingTierId: entity.pricingTierId,
      scoreTotal: entity.scoreTotal,
      scoreBreakdown: entity.scoreBreakdown,
      scoreStatus: entity.scoreStatus,
      reviewedBy: entity.reviewedBy,
      reviewedAt: entity.reviewedAt,
      reviewerNotes: entity.reviewerNotes,
      participantSnapshot: entity.participantSnapshot,
      statusHistory: entity.statusHistory,
      submittedAt: entity.submittedAt,
      lastEditedAt: new Date(),
      withdrawnAt: entity.withdrawnAt,
      withdrawnBy: entity.withdrawnBy,
      updatedAt: new Date(),
    };
  }
}
