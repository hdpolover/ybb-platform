import { ApplicationCategory } from '@prisma/client';

export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly providerId: string, // Auth Provider UUID
    public readonly password?: string,
    public readonly brandId?: string,
    public readonly providerUserId?: string, // External User ID
    public readonly programId?: string,
    public readonly programSlug?: string,
    public readonly referralCode?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly applicationCategory?: ApplicationCategory,
  ) {}
}
