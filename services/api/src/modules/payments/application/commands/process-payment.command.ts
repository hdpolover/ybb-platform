import { ConfirmPaymentDto } from '../../presentation/dto/confirm-payment.dto';

export class ProcessPaymentCommand {
    constructor(
        public readonly intentId: string,
        public readonly dto: ConfirmPaymentDto,
        public readonly userId: string,
    ) { }
}
