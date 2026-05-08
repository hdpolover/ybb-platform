
export class GetAdminsQuery {
    constructor(
        public readonly page: number = 1,
        public readonly limit: number = 10,
        public readonly search?: string,
        public readonly roleId?: string,
        public readonly brandId?: string,
        public readonly programId?: string,
    ) { }
}
