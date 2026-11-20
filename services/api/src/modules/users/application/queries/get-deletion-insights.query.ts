// src/modules/users/application/queries/get-deletion-insights.query.ts
export class GetDeletionInsightsQuery {
  constructor(
    public readonly status?: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
  ) {}
}
