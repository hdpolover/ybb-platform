export class GetPaymentDetailQuery {
    constructor(
        public readonly id: string,
        public readonly userId: string,
    ) { }
}
