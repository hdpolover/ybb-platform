// file: services/api/src/modules/programs/application/commands/unpublish-program.command.ts
export class UnpublishProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly adminId: string,
  ) {}
}
