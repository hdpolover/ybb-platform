import { Injectable } from '@nestjs/common';
import {
  ParticipantApplication,
  ApplicationStatus,
  ApplicationCategory,
  ScoreStatus,
} from '@core/entities/participant-application.entity';
import { ApplicationResponseDto } from '@modules/applications/application/dto/application-response.dto';

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
  toDomain(prismaModel: any): ParticipantApplication {
    return new ParticipantApplication(
      prismaModel.id,
      prismaModel.participantId,
      prismaModel.programId,
      prismaModel.status as ApplicationStatus,
      prismaModel.applicationCategory as ApplicationCategory,
      prismaModel.motivationLetter,
      prismaModel.achievements,
      prismaModel.experiences,
      prismaModel.documents as Record<string, any>,
      prismaModel.requirementFiles as any[],
      prismaModel.twibbonLink,
      prismaModel.pricingTierId,
      prismaModel.paymentAmount ? Number(prismaModel.paymentAmount) : undefined,
      prismaModel.paymentId,
      prismaModel.paymentStatus,
      prismaModel.scoreTotal ? Number(prismaModel.scoreTotal) : undefined,
      prismaModel.scoreBreakdown as Record<string, number>,
      prismaModel.scoreStatus as ScoreStatus,
      prismaModel.reviewedBy,
      prismaModel.reviewedAt,
      prismaModel.reviewerNotes,
      prismaModel.participantSnapshot as Record<string, any>,
      prismaModel.statusHistory as any[],
      prismaModel.createdAt,
      prismaModel.updatedAt,
      prismaModel.submittedAt,
      prismaModel.lastEditedAt,
      prismaModel.withdrawnAt,
      prismaModel.withdrawnBy,
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
      paymentAmount: entity.paymentAmount,
      paymentId: entity.paymentId,
      paymentStatus: entity.paymentStatus,
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
  toPrismaCreate(entity: ParticipantApplication): any {
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
      paymentAmount: entity.paymentAmount,
      paymentId: entity.paymentId,
      paymentStatus: entity.paymentStatus,
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
  toPrismaUpdate(entity: ParticipantApplication): any {
    return {
      status: entity.status,
      applicationCategory: entity.applicationCategory,
      motivationLetter: entity.motivationLetter,
      achievements: entity.achievements,
      experiences: entity.experiences,
      documents: entity.documents,
      requirementFiles: entity.requirementFiles,
      twibbonLink: entity.twibbonLink,
      pricingTierId: entity.pricingTierId,
      paymentAmount: entity.paymentAmount,
      paymentId: entity.paymentId,
      paymentStatus: entity.paymentStatus,
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
