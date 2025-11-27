export class UpdateProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly status?: string,
    public readonly isVisibleToUsers?: boolean,
  ) {}
}
