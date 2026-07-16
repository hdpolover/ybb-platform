import { CreateSocialFeedDto } from '../../presentation/dto/social-feed.dto';

export class CreateSocialFeedCommand {
    constructor(
        public readonly brandId: string,
        public readonly dto: CreateSocialFeedDto,
    ) { }
}
