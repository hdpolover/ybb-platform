import { ICommand } from '@nestjs/cqrs';
import { CreateParticipationInfoDto, UpdateParticipationInfoDto } from '../../presentation/dto/participation-info.dto';

export class UpsertParticipationInfoCommand implements ICommand {
  constructor(
    public readonly programId: string,
    public readonly dto: CreateParticipationInfoDto,
  ) {}
}

export class DeleteParticipationInfoCommand implements ICommand {
  constructor(
    public readonly programId: string,
    public readonly infoId: string,
  ) {}
}
