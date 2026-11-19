// services/api/src/modules/programs/application/commands/program-award.commands.ts
import { CreateProgramAwardDto, UpdateProgramAwardDto } from '../../presentation/dto/program-award.dto';

export class ListProgramAwardsQuery {
  constructor(public readonly programId: string) {}
}

export class CreateProgramAwardCommand {
  constructor(public readonly programId: string, public readonly dto: CreateProgramAwardDto) {}
}

export class UpdateProgramAwardCommand {
  constructor(
    public readonly programId: string,
    public readonly awardId: string,
    public readonly dto: UpdateProgramAwardDto,
  ) {}
}

export class DeleteProgramAwardCommand {
  constructor(public readonly programId: string, public readonly awardId: string) {}
}
