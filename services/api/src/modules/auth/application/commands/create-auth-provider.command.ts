export class CreateAuthProviderCommand {
  constructor(
    public readonly name: string,
    public readonly displayName: string,
    public readonly description?: string,
    public readonly clientId?: string,
    public readonly clientSecret?: string,
    public readonly authUrl?: string,
    public readonly tokenUrl?: string,
    public readonly scopes?: string[],
    public readonly isActive?: boolean,
    public readonly isOAuth?: boolean,
    public readonly icon?: string,
    public readonly buttonColor?: string,
    public readonly order?: number,
  ) {}
}
