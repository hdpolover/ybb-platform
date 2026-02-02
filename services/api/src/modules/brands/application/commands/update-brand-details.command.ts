import { ICommand } from '@nestjs/cqrs';
import { UpdateBrandDetailsDto } from '../../presentation/dto/update-brand-details.dto';

export class UpdateBrandDetailsCommand implements ICommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateBrandDetailsDto,
        public readonly userId: string,
        public readonly files?: { logo?: any; banner?: any },
    ) {}
}
