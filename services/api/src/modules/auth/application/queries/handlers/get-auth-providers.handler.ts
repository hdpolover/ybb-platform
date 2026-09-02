import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { GetAuthProvidersQuery } from '../get-auth-providers.query';
import { AuthProviderDto } from '../../../presentation/dto/auth-provider.dto';
import { fetchActiveAuthProviders } from './active-auth-providers.util';

@Injectable()
export class GetAuthProvidersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async execute(query: GetAuthProvidersQuery): Promise<AuthProviderDto[]> {
    const providers = await fetchActiveAuthProviders(this.prisma, this.cacheService);

    return providers.map(p => ({
        ...p,
        description: p.description || '',
        icon: p.icon || '',
        buttonColor: p.buttonColor || ''
    }));
  }
}
