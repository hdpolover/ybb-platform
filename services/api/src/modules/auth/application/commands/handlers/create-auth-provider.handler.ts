import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CreateAuthProviderCommand } from '../create-auth-provider.command';
import { ConflictException } from '@nestjs/common';

@CommandHandler(CreateAuthProviderCommand)
export class CreateAuthProviderHandler implements ICommandHandler<CreateAuthProviderCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateAuthProviderCommand) {
    const existing = await this.prisma.authProvider.findUnique({
      where: { name: command.name },
    });

    if (existing) {
      throw new ConflictException(`AuthProvider with name ${command.name} already exists`);
    }

    return this.prisma.authProvider.create({
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
  }
}
