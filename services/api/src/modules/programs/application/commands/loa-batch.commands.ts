export class CreateLoaBatchCommand {
  constructor(
    public readonly programId: string,
    public readonly name: string,
    public readonly submissionFrom: Date,
    public readonly submissionTo: Date,
    public readonly adminUserId: string,
  ) {}
}

export class UpdateLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
    public readonly name?: string,
    public readonly submissionFrom?: Date,
    public readonly submissionTo?: Date,
  ) {}
}

export class ReleaseLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
  ) {}
}

export class UnreleaseLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
  ) {}
}

export class DeleteLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
  ) {}
}
