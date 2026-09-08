// services/api/src/modules/readiness/application/commands/handlers/create-readiness-override.handler.ts
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateReadinessOverrideCommand } from '../create-readiness-override.command';
import { ReadinessRepository } from '../../../infrastructure/persistence/readiness.repository';
import { brandRulesFor } from '../../../domain/rules/brand.rules';
import { programRulesFor } from '../../../domain/rules/program.rules';

@CommandHandler(CreateReadinessOverrideCommand)
export class CreateReadinessOverrideHandler implements ICommandHandler<CreateReadinessOverrideCommand> {
  constructor(private readonly repository: ReadinessRepository) {}

  async execute(command: CreateReadinessOverrideCommand): Promise<void> {
    const { input, adminId } = command;

    if (input.reason.trim().length === 0) {
      throw new BadRequestException('An override reason is required');
    }

    // Rule ids are a contract. An override against a typo would sit in the
    // table forever, suppressing nothing, while the admin believed it worked.
    const known = [...brandRulesFor('x'), ...programRulesFor('x')].find((r) => r.id === input.ruleId);
    if (!known) {
      throw new BadRequestException(`Unknown rule id: ${input.ruleId}`);
    }
    if (known.scope !== input.subjectType) {
      throw new BadRequestException(
        `Rule ${input.ruleId} applies to a ${known.scope}, not a ${input.subjectType}`,
      );
    }

    await this.repository.createOverride({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      ruleId: input.ruleId,
      adminId,
      reason: input.reason,
      expiresAt: input.expiresAt,
    });
  }
}
