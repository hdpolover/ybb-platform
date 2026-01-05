import { CreateBrandDto } from '../../presentation/dto/create-brand.dto';

export class CreateBrandCommand {
    constructor(
        public readonly dto: CreateBrandDto,
        public readonly userId: string,
    ) {}
}
