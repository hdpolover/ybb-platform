import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteBrandCommand } from '../delete-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';

@CommandHandler(DeleteBrandCommand)
export class DeleteBrandHandler implements ICommandHandler<DeleteBrandCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly landingRevalidation: LandingRevalidationService,
    ) {}

    async execute(command: DeleteBrandCommand): Promise<void> {
        const { id } = command;
        const brand = await this.brandRepository.findById(id);
        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }
        await this.brandRepository.delete(id);
        await this.landingRevalidation.revalidateSettings();
    }
}
