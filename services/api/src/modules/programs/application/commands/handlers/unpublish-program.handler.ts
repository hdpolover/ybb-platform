// file: services/api/src/modules/programs/application/commands/handlers/unpublish-program.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnpublishProgramCommand } from '../unpublish-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';

@CommandHandler(UnpublishProgramCommand)
export class UnpublishProgramHandler implements ICommandHandler<UnpublishProgramCommand> {
  constructor(
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
  ) {}

  // Never gated. Taking something down must always be possible, including when
  // the program is in a state the readiness engine cannot evaluate. Do not add
  // a readiness check here.
  async execute(command: UnpublishProgramCommand): Promise<void> {
    await this.programRepository.update(command.programId, { isPublished: false });
  }
}
