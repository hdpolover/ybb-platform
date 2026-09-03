export class GetUsersQuery {
  constructor(
    /** undefined = no brand restriction; only reachable by a platform-scope admin. */
    public readonly brandId?: string,
    public readonly skip?: number,
    public readonly take?: number,
    public readonly role?: string,
  ) {}
}
