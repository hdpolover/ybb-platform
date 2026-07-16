export class GetUserProfileQuery {
  constructor(
    public readonly userId: string,
    public readonly brandId: string,
  ) {}
}
