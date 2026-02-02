export class ForgotPasswordCommand {
    constructor(
        public readonly email: string,
        public readonly brandId?: string,
        public readonly ipAddress?: string,
        public readonly userAgent?: string,
    ) { }
}
