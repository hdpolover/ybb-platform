import { CurrentUserData } from '@shared/decorators/current-user.decorator';

export class CreateLoaBatchCommand {
  constructor(
    // May be a program id OR a slug - the admin dashboard's route param is
    // frequently a slug (useResolvedProgramId falls back to the raw route
    // value when the program isn't in the caller's accessiblePrograms, which
    // is the normal steady state for a program-scoped admin, not a race).
    // Resolved once inside the handler; see resolveProgramId() there.
    public readonly programId: string,
    public readonly name: string,
    public readonly submissionFrom: Date,
    public readonly submissionTo: Date,
    public readonly adminUserId: string,
    public readonly actor: CurrentUserData,
  ) {}
}

export class UpdateLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
    public readonly actor: CurrentUserData,
    public readonly name?: string,
    public readonly submissionFrom?: Date,
    public readonly submissionTo?: Date,
  ) {}
}

export class ReleaseLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
    public readonly actor: CurrentUserData,
  ) {}
}

export class UnreleaseLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
    public readonly actor: CurrentUserData,
  ) {}
}

export class DeleteLoaBatchCommand {
  constructor(
    public readonly batchId: string,
    public readonly programId: string,
    public readonly actor: CurrentUserData,
  ) {}
}
