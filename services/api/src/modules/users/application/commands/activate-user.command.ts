export class ActivateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly brandId: string,
  ) {}
}
