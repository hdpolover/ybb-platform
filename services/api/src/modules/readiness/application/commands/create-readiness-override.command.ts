// services/api/src/modules/readiness/application/commands/create-readiness-override.command.ts
import { ReadinessScope } from '../../domain/readiness-rule.types';

export interface CreateOverrideInput {
  subjectType: ReadinessScope;
  subjectId: string;
  ruleId: string;
  reason: string;
  expiresAt: Date | null;
}

export class CreateReadinessOverrideCommand {
  constructor(
    public readonly input: CreateOverrideInput,
    public readonly adminId: string,
  ) {}
}
