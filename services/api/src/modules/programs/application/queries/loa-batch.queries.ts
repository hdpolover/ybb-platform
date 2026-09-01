export class GetLoaBatchesQuery {
  constructor(public readonly programId: string) {}
}

export class GetLoaDownloadsQuery {
  constructor(public readonly programId: string) {}
}

export class GetLoaBatchRecipientSendsQuery {
  constructor(
    public readonly programId: string,
    public readonly batchId: string,
  ) {}
}
