import { UpdateSponsorDto } from '../../presentation/dto/sponsor.dto';

export class UpdateSponsorCommand {
    constructor(
        public readonly brandId: string,
        public readonly sponsorId: string,
        public readonly dto: UpdateSponsorDto,
        public readonly userId: string,
        public readonly file?: Express.Multer.File,
    ) {}
}
