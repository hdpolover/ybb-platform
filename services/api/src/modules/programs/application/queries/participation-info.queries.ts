import { IQuery } from '@nestjs/cqrs';
import { ApplicationCategory } from '@prisma/client';

export class GetParticipationInfoQuery implements IQuery {
  constructor(
    public readonly programId: string,
    public readonly category: ApplicationCategory,
  ) {}
}

export class ListParticipationInfoQuery implements IQuery {
  constructor(
    public readonly programId: string,
  ) {}
}
