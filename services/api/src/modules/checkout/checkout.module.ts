// services/api/src/modules/checkout/checkout.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { PortalModule } from '@modules/portal/portal.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutGatewayMethodService } from './checkout-gateway-method.service';
import { CheckoutHandler } from './checkout.handler';
import { CheckoutPolicyService } from './checkout-policy.service';
import { TurnstileModule } from '@shared/infrastructure/turnstile/turnstile.module';

@Module({
    // AuthModule: RegisterHandler + guard deps (see platform-settings.module.ts).
    // PortalModule: the invoice and payment handlers the portal itself uses.
    // PaymentsModule: PaymentServiceHttpClient for the method lookup. None of the
    // three imports CheckoutModule, so no cycle.
    imports: [AuthModule, PaymentsModule, PortalModule, TurnstileModule],
    controllers: [CheckoutController],
    providers: [CheckoutPolicyService, CheckoutHandler, CheckoutGatewayMethodService],
    exports: [CheckoutPolicyService],
})
export class CheckoutModule {}
