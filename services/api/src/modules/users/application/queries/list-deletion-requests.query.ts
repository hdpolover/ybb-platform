export class ListDeletionRequestsQuery {
  constructor(
    public readonly status?: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
