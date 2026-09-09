// src/shared/infrastructure/http/compression.config.spec.ts
import { Request, Response } from 'express';
import { shouldCompressResponse } from './compression.config';

function makeRes(headers: Record<string, string> = {}): Response {
    return {
        getHeader: (name: string) => headers[name],
    } as unknown as Response;
}

function makeReq(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
}

describe('shouldCompressResponse (M170 / M176)', () => {
    it('compresses an ordinary JSON response', () => {
        const req = makeReq({ 'content-type': 'application/json' });
        const res = makeRes({ 'Content-Type': 'application/json' });

        expect(shouldCompressResponse(req, res)).toBe(true);
    });

    it('does NOT compress a response carrying Content-Disposition (file downloads)', () => {
        // Both the applications xlsx export (export-applications.handler.ts,
        // StreamableFile disposition option) and the payment proof-file
        // download (payment-admin.controller.ts res.setHeader) set this
        // header. Re-compressing an already zip-based xlsx or arbitrary proof
        // bytes burns CPU for ~0 size reduction and adds a buffering stage to
        // what should stream straight through.
        const req = makeReq({});
        const res = makeRes({
            'Content-Disposition': 'attachment; filename="applications_export.xlsx"',
        });

        expect(shouldCompressResponse(req, res)).toBe(false);
    });

    it('does NOT compress an inline Content-Disposition either (LOA preview PDF)', () => {
        const req = makeReq({});
        const res = makeRes({ 'Content-Disposition': 'inline; filename="preview.pdf"' });

        expect(shouldCompressResponse(req, res)).toBe(false);
    });

    it('respects the standard x-no-compression opt-out via the underlying compression.filter', () => {
        const req = makeReq({ 'x-no-compression': '1' });
        const res = makeRes({ 'Content-Type': 'application/json' });

        expect(shouldCompressResponse(req, res)).toBe(false);
    });
});
