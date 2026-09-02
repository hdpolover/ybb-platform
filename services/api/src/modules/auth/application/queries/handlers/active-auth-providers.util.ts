// services/api/src/modules/auth/application/queries/handlers/active-auth-providers.util.ts
//
// Shared by GetAuthProvidersHandler and GetAuthContextHandler, which both ran
// this exact query uncached on every login-page load. auth_providers has no
// brandId column (it's global, not per-brand), so one cache entry serves
// every brand.
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../../../shared/constants/cache-keys';

export type ActiveAuthProvider = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isOAuth: boolean;
  icon: string | null;
  buttonColor: string | null;
};

export async function fetchActiveAuthProviders(
  prisma: PrismaService,
  cache: CacheService,
): Promise<ActiveAuthProvider[]> {
  const cached = await cache.get<ActiveAuthProvider[]>(CACHE_KEYS.AUTH_PROVIDERS_LIST);
  if (cached) return cached;

  const providers = await prisma.authProvider.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      displayName: true,
      description: true,
      isOAuth: true,
      icon: true,
      buttonColor: true,
    },
    orderBy: { order: 'asc' },
  });

  await cache.set(CACHE_KEYS.AUTH_PROVIDERS_LIST, providers, CACHE_TTL.MEDIUM);
  return providers;
}
