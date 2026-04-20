export class DeactivateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly brandId: string,
  ) {}
}
