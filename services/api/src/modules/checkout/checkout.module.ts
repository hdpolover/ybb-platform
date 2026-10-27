// services/api/src/modules/checkout/checkout.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutPolicyService } from './checkout-policy.service';

@Module({
    // AuthModule: the follow-up POST /v1/checkout registers a user and the module
    // will grow guarded routes; guards resolve their deps from it (see
    // platform-settings.module.ts). PaymentsModule joins with that phase.
    imports: [AuthModule],
    controllers: [CheckoutController],
    providers: [CheckoutPolicyService],
    exports: [CheckoutPolicyService],
})
export class CheckoutModule {}
