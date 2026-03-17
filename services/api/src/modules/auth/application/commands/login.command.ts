export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly brandId?: string,
    public readonly programId?: string,
    public readonly programSlug?: string,
  ) {}
}
