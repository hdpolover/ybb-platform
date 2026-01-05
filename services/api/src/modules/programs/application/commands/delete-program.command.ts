export class DeleteProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly userId: string,
  ) {}
}
