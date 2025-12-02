/**
 * Get Application Query
 * 
 * Application Layer - Query
 */
export class GetApplicationQuery {
  constructor(
    public readonly applicationId: string,
    public readonly includeRelations?: boolean,
  ) {}
}
