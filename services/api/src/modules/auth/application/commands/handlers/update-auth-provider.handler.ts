import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '../../../../../shared/constants/cache-keys';
import { UpdateAuthProviderCommand } from '../update-auth-provider.command';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(UpdateAuthProviderCommand)
export class UpdateAuthProviderHandler implements ICommandHandler<UpdateAuthProviderCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: UpdateAuthProviderCommand) {
    const { id, data } = command;

    const existing = await this.prisma.authProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AuthProvider with ID ${id} not found`);
    }

    const updated = await this.prisma.authProvider.update({
      where: { id },
      data: {
        ...data,
      },
    });

    await this.cacheService.invalidateKey(CACHE_KEYS.AUTH_PROVIDERS_LIST);
    return updated;
  }
}
