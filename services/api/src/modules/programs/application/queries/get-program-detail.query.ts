export class GetProgramDetailQuery {
  constructor(
    public readonly identifier: string,
    public readonly include?: string,
    public readonly testimonialsLimit?: number,
    public readonly announcementsLimit?: number,
    public readonly resourcesLimit?: number,
    // Audit M13: whether the caller is an admin, so the handler can force
    // public-safe filters (and hide non-public resources) for everyone else.
    public readonly isAdmin?: boolean,
  ) {}
}
