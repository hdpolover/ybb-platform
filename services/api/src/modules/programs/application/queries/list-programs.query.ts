export class ListProgramsQuery {
  constructor(
    public readonly brandId?: string,
    public readonly year?: number,
    public readonly isPublished?: boolean,
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly isActive?: boolean,
    public readonly isVisibleToUsers?: boolean,
    public readonly status?: string,
    public readonly url?: string,
    // Audit M13: whether the caller is an admin, so findAll can force
    // public-safe filters for everyone else. See program.repository.interface.ts.
    public readonly isAdmin?: boolean,
  ) { }
}
