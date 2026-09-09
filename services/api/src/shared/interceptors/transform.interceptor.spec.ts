// src/shared/interceptors/transform.interceptor.spec.ts
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor (M79)', () => {
    const interceptor = new TransformInterceptor<unknown>();

    const makeContext = (): ExecutionContext =>
        ({
            switchToHttp: () => ({
                getResponse: () => ({ statusCode: 200 }),
            }),
        }) as unknown as ExecutionContext;

    const makeHandler = (data: unknown): CallHandler => ({
        handle: () => of(data),
    });

    it('does not deep-copy the payload: nested object identity is preserved', async () => {
        // Pinning the actual M79 fix: the interceptor used to rebuild the whole
        // response tree via Object.entries/fromEntries (normalizeDates) on every
        // response even though it changed nothing JSON.stringify wouldn't already
        // do for Date values. If that pass ever comes back, this nested object
        // reference stops being ===, since Object.fromEntries always allocates a
        // new object even when every value is unchanged.
        const nested = { id: 'abc', createdAt: new Date('2026-01-01T00:00:00.000Z') };
        const payload = { profile: nested };

        const result = await lastValueFrom(
            interceptor.intercept(makeContext(), makeHandler(payload)),
        );

        expect((result.data as typeof payload).profile).toBe(nested);
    });

    it('leaves Date instances as Date instances (JSON.stringify normalizes them at send time)', async () => {
        const createdAt = new Date('2026-03-15T12:30:00.000Z');
        const payload = { id: '1', createdAt };

        const result = await lastValueFrom(
            interceptor.intercept(makeContext(), makeHandler(payload)),
        );

        const data = result.data as typeof payload;
        expect(data.createdAt).toBeInstanceOf(Date);
        // The property this replaces normalizeDates for: JSON.stringify must still
        // produce the same ISO string a hand-rolled toISOString() pass would have.
        expect(JSON.stringify(data)).toBe(JSON.stringify({ ...payload, createdAt: createdAt.toISOString() }));
    });

    it('still wraps a plain object in the standard {statusCode, message, data} envelope', async () => {
        const result = await lastValueFrom(
            interceptor.intercept(makeContext(), makeHandler({ id: '1', name: 'x' })),
        );

        expect(result).toEqual({
            statusCode: 200,
            message: 'Success',
            data: { id: '1', name: 'x' },
        });
    });

    it('still rewrites the {items, meta} pattern into {data, meta}', async () => {
        const result = await lastValueFrom(
            interceptor.intercept(
                makeContext(),
                makeHandler({ items: [{ id: '1' }], meta: { total: 1 } }),
            ),
        );

        expect(result).toEqual({
            statusCode: 200,
            message: 'Success',
            data: [{ id: '1' }],
            meta: { total: 1 },
        });
    });
});
