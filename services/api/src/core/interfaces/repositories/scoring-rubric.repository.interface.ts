// services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts
import { ScoringStage } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type ScoringCriterionNested = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  weight: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  order: number;
  legacyId: number | null;
};

export type ScoringCategoryNested = {
  id: string;
  schemaId: string;
  name: string;
  description: string | null;
  weight: Prisma.Decimal;
  order: number;
  legacyId: string | null;
  criteria: ScoringCriterionNested[];
};

export type ScoringSchemaWithNested = {
  id: string;
  programId: string;
  stage: ScoringStage;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  createdById: string | null;
  passThreshold: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  legacyId: number | null;
  categories: ScoringCategoryNested[];
};

export type UpsertCriterionPayload = {
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  order: number;
};

export type UpsertCategoryPayload = {
  name: string;
  description?: string;
  weight: number;
  order: number;
  criteria: UpsertCriterionPayload[];
};

export type UpsertRubricPayload = {
  name?: string;
  description?: string;
  passThreshold?: number;
  categories: UpsertCategoryPayload[];
};

export interface IScoringRubricRepository {
  /** The current version, or null if the program/stage has never had a rubric. */
  findActiveRubric(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested | null>;

  /** A specific past or present version, for history inspection. */
  findRubricVersion(
    programId: string,
    stage: ScoringStage,
    version: number,
  ): Promise<ScoringSchemaWithNested | null>;

  /** Every version for a program/stage, newest first. */
  findRubricHistory(
    programId: string,
    stage: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]>;

  /**
   * Deep-copies the payload into a new ScoringSchema version and flips the
   * previous active version (if any) to isActive=false. A payload that is
   * semantically identical to the current active version (same names,
   * descriptions, weights, maxScore, order, and row count) mints nothing
   * and returns the existing active version unchanged.
   */
  mintRubricVersion(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
    createdById: string | null,
  ): Promise<ScoringSchemaWithNested>;
}
