export class AmbassadorLoginCommand {
  constructor(
    public readonly email: string,
    public readonly referralCode: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly brandId?: string,
  ) {}
}
