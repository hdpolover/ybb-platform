import { CurrentUserData } from '@shared/decorators/current-user.decorator';

export class GetLoaBatchesQuery {
  constructor(
    public readonly programId: string,
    public readonly actor: CurrentUserData,
  ) {}
}

export class GetLoaDownloadsQuery {
  constructor(
    public readonly programId: string,
    public readonly actor: CurrentUserData,
  ) {}
}

export class GetLoaBatchRecipientSendsQuery {
  constructor(
    public readonly programId: string,
    public readonly batchId: string,
    public readonly actor: CurrentUserData,
  ) {}
}
