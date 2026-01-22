import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UpdateAuthProviderCommand } from '../update-auth-provider.command';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(UpdateAuthProviderCommand)
export class UpdateAuthProviderHandler implements ICommandHandler<UpdateAuthProviderCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateAuthProviderCommand) {
    const { id, data } = command;

    const existing = await this.prisma.authProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AuthProvider with ID ${id} not found`);
    }

    return this.prisma.authProvider.update({
      where: { id },
      data: {
        ...data,
      },
    });
  }
}
