export class VerifyEmailCommand {
  constructor(
    public readonly token: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
