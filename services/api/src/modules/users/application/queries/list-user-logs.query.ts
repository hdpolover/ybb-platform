export class ListUserActivityLogsQuery {
    constructor(
        public readonly userId: string,
        public readonly page: number = 1,
        public readonly limit: number = 20,
    ) { }
}

export class ListUserSecurityLogsQuery {
    constructor(
        public readonly userId: string,
        public readonly page: number = 1,
        public readonly limit: number = 20,
    ) { }
}
