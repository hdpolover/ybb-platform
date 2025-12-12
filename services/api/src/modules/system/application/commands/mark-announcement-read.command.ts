export class MarkAnnouncementReadCommand {
    constructor(
        public readonly userId: string,
        public readonly announcementId: string,
        public readonly dismiss: boolean = false,
    ) { }
}
