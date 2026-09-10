import { Injectable } from '@nestjs/common';
import {
  ParticipantApplication,
  ApplicationStatus,
  ApplicationCategory,
  ApplicationUpdateField,
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
      documentFiles: entity.documents || {},
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
   * Convert Domain Entity to Prisma update input.
   *
   * Audit M112: this used to unconditionally spread every field on `entity`
   * (scoreTotal/scoreBreakdown/scoreStatus/documents included), regardless of
   * what the calling command actually changed. `entity` is a snapshot read at
   * the START of the request, so any field the command didn't touch is just
   * that stale read written back verbatim - a lost update for any column a
   * concurrent write (e.g. upsert-application-review's rubric scoring, which
   * writes scoreTotal/scoreStatus directly via `tx.participantApplication.update`
   * and never goes through this mapper) changed in between.
   *
   * `fields` is the caller's explicit list of columns THIS command intends to
   * write - see the four call sites in application/commands/handlers
   * (withdraw/submit/review/update). Only listed fields are included; nothing
   * else is spread from the stale entity. updatedAt/lastEditedAt are bumped
   * unconditionally, matching prior behavior - they are per-write bookkeeping
   * timestamps, not content that can be "clobbered" by a stale read.
   */
  toPrismaUpdate(
    entity: ParticipantApplication,
    fields: readonly ApplicationUpdateField[],
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
      lastEditedAt: new Date(),
    };

    for (const field of fields) {
      switch (field) {
        case 'status':
          patch.status = entity.status;
          break;
        case 'applicationCategory':
          // Only write applicationCategory when the entity actually carries one.
          // Spreading it unconditionally let a null/undefined entity value overwrite
          // a real category in the DB with NULL (e.g. via the admin update path).
          if (entity.applicationCategory != null) {
            patch.applicationCategory = entity.applicationCategory;
          }
          break;
        case 'motivationLetter':
          patch.motivationLetter = entity.motivationLetter;
          break;
        case 'achievements':
          patch.achievements = entity.achievements;
          break;
        case 'experiences':
          patch.experiences = entity.experiences;
          break;
        case 'documents':
          // M102/M113: the JSON column is `documentFiles`; `documents` on the
          // Prisma model is a relation field.
          patch.documentFiles = entity.documents;
          break;
        case 'requirementFiles':
          patch.requirementFiles = entity.requirementFiles;
          break;
        case 'twibbonLink':
          patch.twibbonLink = entity.twibbonLink;
          break;
        case 'pricingTierId':
          patch.pricingTierId = entity.pricingTierId;
          break;
        case 'reviewedBy':
          patch.reviewedBy = entity.reviewedBy;
          break;
        case 'reviewedAt':
          patch.reviewedAt = entity.reviewedAt;
          break;
        case 'reviewerNotes':
          patch.reviewerNotes = entity.reviewerNotes;
          break;
        case 'statusHistory':
          patch.statusHistory = entity.statusHistory;
          break;
        case 'submittedAt':
          patch.submittedAt = entity.submittedAt;
          break;
        case 'withdrawnAt':
          patch.withdrawnAt = entity.withdrawnAt;
          break;
        case 'withdrawnBy':
          patch.withdrawnBy = entity.withdrawnBy;
          break;
      }
    }

    return patch;
  }
}

// Deliberately excludes scoreTotal/scoreBreakdown/scoreStatus/participantSnapshot
// from ApplicationUpdateField (defined in participant-application.entity.ts):
// no caller of toPrismaUpdate ever sets these on the domain entity - scoring is
// written directly by upsert-application-review.handler.ts, and
// participantSnapshot only by account-deletion-purge.service.ts - so they were
// dead weight in the old unconditional spread that could only ever clobber a
// concurrent write, never legitimately help. Re-exported here for callers that
// already import field/type names from this module.
export type { ApplicationUpdateField };
