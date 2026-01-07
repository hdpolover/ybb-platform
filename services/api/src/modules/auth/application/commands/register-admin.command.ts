export class RegisterAdminCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly fullName: string,
    public readonly secretKey: string,
    public readonly programCategoryId: string,
    public readonly role: string,
  ) {}
}
