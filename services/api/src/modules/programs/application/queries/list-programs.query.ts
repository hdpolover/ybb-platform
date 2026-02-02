export class ListProgramsQuery {
  constructor(
    public readonly brandId?: string,
    public readonly year?: number,
    public readonly isPublished?: boolean,
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly isActive?: boolean,
    public readonly status?: string,
  ) { }
}
