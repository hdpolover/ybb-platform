// file: services/api/src/modules/programs/application/commands/publish-program.command.ts
export class PublishProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly adminId: string,
  ) {}
}
