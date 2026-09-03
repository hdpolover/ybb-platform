export class DeactivateUserCommand {
  constructor(
    public readonly userId: string,
    /** undefined = no brand restriction; only reachable by a platform-scope admin. */
    public readonly brandId?: string,
  ) {}
}
