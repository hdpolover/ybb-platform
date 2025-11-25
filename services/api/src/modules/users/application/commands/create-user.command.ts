export class CreateUserCommand {
  constructor(
    public readonly brandId: string,
    public readonly email: string,
    public readonly password: string,
  ) {}
}
