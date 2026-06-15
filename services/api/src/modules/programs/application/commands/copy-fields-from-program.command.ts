export class CopyFieldsFromProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly sourceProgramId: string,
    public readonly fieldIds: string[] | undefined,
    public readonly mode: 'append' | 'replace',
  ) {}
}
