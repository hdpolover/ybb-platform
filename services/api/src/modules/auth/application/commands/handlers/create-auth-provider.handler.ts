import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '../../../../../shared/constants/cache-keys';
import { CreateAuthProviderCommand } from '../create-auth-provider.command';
import { ConflictException } from '@nestjs/common';

@CommandHandler(CreateAuthProviderCommand)
export class CreateAuthProviderHandler implements ICommandHandler<CreateAuthProviderCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: CreateAuthProviderCommand) {
    const existing = await this.prisma.authProvider.findUnique({
      where: { name: command.name },
    });

    if (existing) {
      throw new ConflictException(`AuthProvider with name ${command.name} already exists`);
    }

    const created = await this.prisma.authProvider.create({
      data: {
        name: command.name,
        displayName: command.displayName,
        description: command.description,
        clientId: command.clientId,
        clientSecret: command.clientSecret,
        authUrl: command.authUrl,
        tokenUrl: command.tokenUrl,
        scopes: command.scopes,
        isActive: command.isActive ?? true,
        isOAuth: command.isOAuth ?? false,
        icon: command.icon,
        buttonColor: command.buttonColor,
        order: command.order ?? 0,
      },
    });

    await this.cacheService.invalidateKey(CACHE_KEYS.AUTH_PROVIDERS_LIST);
    return created;
  }
}
