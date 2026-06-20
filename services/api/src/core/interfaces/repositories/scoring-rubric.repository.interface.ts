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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  legacyId: number | null;
  categories: ScoringCategoryNested[];
};

export type UpsertCriterionPayload = {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  order: number;
};

export type UpsertCategoryPayload = {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  order: number;
  criteria: UpsertCriterionPayload[];
};

export type UpsertRubricPayload = {
  name?: string;
  description?: string;
  categories: UpsertCategoryPayload[];
};

export interface IScoringRubricRepository {
  findRubricsByProgramId(
    programId: string,
    stage?: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]>;

  upsertRubric(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
  ): Promise<ScoringSchemaWithNested>;
}
