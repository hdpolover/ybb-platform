import { CreateSponsorDto } from '../../presentation/dto/sponsor.dto';

export class CreateSponsorCommand {
    constructor(
        public readonly brandId: string,
        public readonly dto: CreateSponsorDto,
        public readonly userId: string,
        public readonly file?: Express.Multer.File,
    ) {}
}
