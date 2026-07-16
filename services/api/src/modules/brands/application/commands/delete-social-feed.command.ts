export class DeleteSocialFeedCommand {
    constructor(
        public readonly brandId: string,
        public readonly socialFeedId: string,
    ) { }
}
