export class GetParticipantProgressQuery {
  constructor(
    public readonly programId: string,
    public readonly userId: string,
  ) {}
}
