export class GetProgramDetailQuery {
  constructor(
    public readonly identifier: string,
    public readonly include?: string,
    public readonly testimonialsLimit?: number,
    public readonly announcementsLimit?: number,
    public readonly resourcesLimit?: number,
  ) {}
}
