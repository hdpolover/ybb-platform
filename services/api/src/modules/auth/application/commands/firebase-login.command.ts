import { ApplicationCategory } from '@prisma/client';
import { AdAttributionInput } from '../services/ad-attribution.util';

export class FirebaseLoginCommand {
  constructor(
    public readonly idToken: string,
    public readonly providerId: string | undefined,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly brandId?: string,
    public readonly programId?: string,
    public readonly programSlug?: string,
    public readonly referralCode?: string,
    public readonly applicationCategory?: ApplicationCategory,
    public readonly adAttribution?: AdAttributionInput,
  ) {}
}
