export class LogoutCommand {
    constructor(
        public readonly userId: string,
        public readonly jti: string,
        public readonly tokenExpiresAt: number, // Unix timestamp in seconds
    ) { }
}
