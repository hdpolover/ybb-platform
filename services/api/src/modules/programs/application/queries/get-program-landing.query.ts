export class GetProgramLandingQuery {
  constructor(
    public readonly programId: string,
    public readonly newsLimit: number = 3,
    public readonly awardsLimit: number = 6,
  ) {}
}
