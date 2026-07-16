// Command for creating registration payment intent
export class CreateRegistrationPaymentIntentCommand {
  constructor(
    public readonly applicationId: string,
    public readonly userId: string,
    public readonly paymentMethodId?: string, // e.g., 'credit_card', 'bca_va'
  ) {}
}
