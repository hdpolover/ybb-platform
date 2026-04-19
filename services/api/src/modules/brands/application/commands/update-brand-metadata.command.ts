import { ICommand } from '@nestjs/cqrs';

export class UpdateBrandMetadataCommand implements ICommand {
    constructor(
        public readonly id: string,
        public readonly patch: Record<string, unknown>,
        public readonly userId: string,
    ) {}
}
