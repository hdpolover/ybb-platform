import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { UpdateBrandMetadataCommand } from '../update-brand-metadata.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';

@CommandHandler(UpdateBrandMetadataCommand)
export class UpdateBrandMetadataHandler implements ICommandHandler<UpdateBrandMetadataCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
    ) {}

    async execute(command: UpdateBrandMetadataCommand): Promise<Record<string, unknown>> {
        const { id, patch } = command;
        try {
            return await this.brandRepository.updateMetadata(id, patch);
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new NotFoundException(`Brand with ID ${id} not found`);
            }
            throw error;
        }
    }
}
