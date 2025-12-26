import { Payment } from '../../entities/payment.entity';

export interface IPaymentRepository {
    findByUserId(userId: string): Promise<Payment[]>;
    findById(id: string): Promise<Payment | null>;
}
