export class ResendVerificationEmailCommand {
  constructor(
    public readonly email: string,
    public readonly programCategoryId?: string,
  ) {}
}
