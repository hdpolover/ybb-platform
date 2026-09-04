export class CancelDeletionRequestCommand {
    constructor(
        public readonly requestId: string,
        public readonly token: string,
    ) { }
}
