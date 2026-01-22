import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAuthProvidersQuery } from '../get-auth-providers.query';
import { AuthProviderDto } from '../../../presentation/dto/auth-provider.dto';

@Injectable()
export class GetAuthProvidersHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetAuthProvidersQuery): Promise<AuthProviderDto[]> {
    const providers = await this.prisma.authProvider.findMany({
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

    return providers.map(p => ({
        ...p,
        description: p.description || '',
        icon: p.icon || '',
        buttonColor: p.buttonColor || ''
    }));
  }
}
