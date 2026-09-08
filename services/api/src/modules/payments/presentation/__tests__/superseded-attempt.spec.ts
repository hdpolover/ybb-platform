// src/modules/payments/presentation/__tests__/superseded-attempt.spec.ts
//
// M157: resolveFailureInvoice finds the invoice by id (or by application) and
// never checks that the event describes the invoice's CURRENT attempt. A
// participant who retries after a failure gets a NEW gateway transaction on the
// same invoice, so a late payment.failed for the abandoned first attempt marked
// the retry failed — and mailed them a failure notice for a payment that was
// still in flight, or had already settled.
import { isSupersededAttempt } from '../payment-events.controller';

const CURRENT = { externalTransactionId: 'txn-2', externalIntentId: 'int-2' };

describe('isSupersededAttempt', () => {
    it('flags a failure carrying the abandoned attempt\'s transaction id', () => {
        expect(isSupersededAttempt(CURRENT, { transactionId: 'txn-1' })).toBe(true);
    });

    it('flags a failure carrying the abandoned attempt\'s intent id', () => {
        expect(isSupersededAttempt(CURRENT, { intentId: 'int-1' })).toBe(true);
    });

    it('lets the current attempt through on either id', () => {
        expect(isSupersededAttempt(CURRENT, { transactionId: 'txn-2' })).toBe(false);
        expect(isSupersededAttempt(CURRENT, { intentId: 'int-2' })).toBe(false);
        expect(isSupersededAttempt(CURRENT, { transactionId: 'txn-2', intentId: 'int-2' })).toBe(false);
    });

    // Conservative by design: only a DEFINITE mismatch counts. Anything else has
    // to behave exactly as it did before, or this guard starts swallowing real
    // failures — which is worse than the bug it fixes, since the invoice would
    // sit unpaid with nobody told.
    it('does not flag when there is nothing to compare', () => {
        expect(isSupersededAttempt(CURRENT, {})).toBe(false);
        expect(isSupersededAttempt({ externalTransactionId: null, externalIntentId: null }, { transactionId: 'txn-1' })).toBe(false);
        expect(isSupersededAttempt({ externalTransactionId: undefined, externalIntentId: undefined }, { intentId: 'int-1' })).toBe(false);
    });

    it('flags when either id mismatches, even if the other matches', () => {
        // A gateway that reuses one id across attempts must not launder the other.
        expect(isSupersededAttempt(CURRENT, { transactionId: 'txn-1', intentId: 'int-2' })).toBe(true);
        expect(isSupersededAttempt(CURRENT, { transactionId: 'txn-2', intentId: 'int-1' })).toBe(true);
    });
});
