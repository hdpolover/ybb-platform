export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly password?: string,
    public readonly programCategoryId?: string,
    public readonly provider: string = 'local',
    public readonly providerId?: string,
    public readonly programId?: string,
  ) {}
}
