import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { DeleteAuthProviderCommand } from '../delete-auth-provider.command';
import { NotFoundException } from '@nestjs/common';

@CommandHandler(DeleteAuthProviderCommand)
export class DeleteAuthProviderHandler implements ICommandHandler<DeleteAuthProviderCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteAuthProviderCommand) {
    const { id } = command;

    const existing = await this.prisma.authProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`AuthProvider with ID ${id} not found`);
    }

    // Check if used by identities? 
    // Usually strict relations prevent delete, or we soft delete.
    // The schema has deletedAt, so we should soft delete.
    
    // Check if deletedAt is already set if we want to be strict, but update handles it.

    return this.prisma.authProvider.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    });

    // Or if we want hard delete:
    // return this.prisma.authProvider.delete({ where: { id } });
  }
}
