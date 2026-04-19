export class ApplyFormTemplateCommand {
  constructor(
    public readonly programId: string,
    public readonly templateId: string,
    public readonly mode: 'append' | 'replace',
  ) {}
}
