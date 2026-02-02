export class FirebaseLoginCommand {
  constructor(
    public readonly idToken: string,
    public readonly providerId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly brandId?: string,
    public readonly programId?: string,
    public readonly programSlug?: string,
    public readonly referralCode?: string,
  ) {}
}
