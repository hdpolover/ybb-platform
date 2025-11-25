export class GetUsersQuery {
  constructor(
    public readonly brandId: string,
    public readonly skip?: number,
    public readonly take?: number,
  ) {}
}
