import { ICommand } from '@nestjs/cqrs';
import { UpdateBrandSettingsDto } from '../../presentation/dto/update-brand-settings.dto';

export class UpdateBrandSettingsCommand implements ICommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateBrandSettingsDto,
        public readonly userId: string,
    ) {}
}
