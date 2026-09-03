/**
 * Registration Fee Mismatches Query
 *
 * Application Layer - Query
 */
export class RegistrationFeeMismatchesQuery {
  constructor(
    public readonly programId: string,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
