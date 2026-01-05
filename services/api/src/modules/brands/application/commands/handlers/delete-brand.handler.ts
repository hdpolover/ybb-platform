import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteBrandCommand } from '../delete-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';

@CommandHandler(DeleteBrandCommand)
export class DeleteBrandHandler implements ICommandHandler<DeleteBrandCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
    ) {}

    async execute(command: DeleteBrandCommand): Promise<void> {
        const { id } = command;
        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }
        await this.brandRepository.delete(id);
    }
}
