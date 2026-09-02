// services/api/src/modules/payments/presentation/__tests__/legacy-infra-payments-routes.spec.ts
import { glob } from 'glob';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SRC_ROOT = resolve(__dirname, '../../../..');

/**
 * The legacy `/v1/infra/payments` controller was removed: it exposed manual-proof
 * submission, intent lookup by reference and payment-method listing to any logged-in
 * caller with no ownership check, and nothing called it (participants go through
 * `/v1/portal/payments/*`, admins through `/v1/admin/payments/*`).
 *
 * These assertions fail if the routes are reintroduced without an ownership check.
 */
describe('legacy /v1/infra/payments routes stay removed', () => {
    it('no controller is mounted under infra/payments', async () => {
        const files = await glob('**/*.ts', { cwd: SRC_ROOT, absolute: true, ignore: '**/*.spec.ts' });
        const offenders = files.filter((file) => /infra\/payments/.test(readFileSync(file, 'utf8')));

        expect(offenders).toEqual([]);
    });

    it('the legacy controller and its DTOs are gone', () => {
        const removed = [
            'modules/payments/infrastructure/presentation/payment.controller.ts',
            'modules/payments/infrastructure/presentation/dto/payment.dto.ts',
        ];

        expect(removed.filter((path) => existsSync(resolve(SRC_ROOT, path)))).toEqual([]);
    });

    it('PaymentModule registers no controllers', async () => {
        const { PaymentModule } = await import('@modules/payments/payment.module');

        expect(Reflect.getMetadata('controllers', PaymentModule) ?? []).toEqual([]);
    });
});
