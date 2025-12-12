export class Payment {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly applicationId: string,
        public readonly amount: number,
        public readonly currency: string,
        public readonly status: string,
        public readonly paymentType: string,
        public readonly paymentMethod?: string,
        public readonly paidAt?: Date,
        public readonly createdAt?: Date,
        public readonly updatedAt?: Date,
    ) { }
}
