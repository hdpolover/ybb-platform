export class GetUserQuery {
  constructor(
    public readonly id: string,
    /** undefined = no brand restriction; only reachable by a platform-scope admin. */
    public readonly brandId?: string,
  ) {}
}
