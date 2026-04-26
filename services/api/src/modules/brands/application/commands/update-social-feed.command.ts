import { UpdateSocialFeedDto } from '../../presentation/dto/social-feed.dto';

export class UpdateSocialFeedCommand {
    constructor(
        public readonly brandId: string,
        public readonly socialFeedId: string,
        public readonly dto: UpdateSocialFeedDto,
    ) { }
}
