export class UpdateAuthProviderCommand {
  constructor(
    public readonly id: string,
    public readonly data: {
      name?: string;
      displayName?: string;
      description?: string;
      clientId?: string;
      clientSecret?: string;
      authUrl?: string;
      tokenUrl?: string;
      scopes?: any;
      isActive?: boolean;
      isOAuth?: boolean;
      icon?: string;
      buttonColor?: string;
      order?: number;
    },
  ) {}
}
