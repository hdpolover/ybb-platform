export class ListApplicationDocumentsQuery {
    constructor(
        public readonly applicationId: string,
        public readonly userId: string,
    ) { }
}
