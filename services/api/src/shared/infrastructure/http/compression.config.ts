// Namespace import, not a default import: the repo's tsconfig does not set
// esModuleInterop, and under plain commonjs compilation a default import of
// compression's CJS export loses the .filter static property attached to the
// exported function, which this module depends on.
import * as compression from 'compression';
import { Request, Response, RequestHandler } from 'express';

/**
 * HTTP response compression (audit M170/M176), factored out of main.ts so the
 * filter logic is unit-testable without booting the full Nest application
 * (main.ts connects to RabbitMQ and Postgres at import time).
 *
 * threshold: 1024 skips compressing tiny responses where gzip overhead would
 * exceed the savings.
 *
 * The filter skips any response carrying a Content-Disposition header -- the
 * applications export (StreamableFile, export-applications.handler.ts) and the
 * payment proof-file download (payment-admin.controller.ts) both set it. A
 * binary file download gains nothing from being re-wrapped in a second
 * compression layer: the xlsx export is already zip-compressed and a proof
 * file is arbitrary uploaded bytes, so running either through zlib spends CPU
 * for ~0 size reduction while adding a buffering stage to a response that is
 * otherwise streamed straight through.
 */
// Exported standalone so it can be unit-tested without constructing the
// compression middleware itself (compression() returns an opaque Express
// handler with no way to invoke just the filter from outside a real request).
export function shouldCompressResponse(req: Request, res: Response): boolean {
    // Documented escape hatch (compression's own README) for debugging a
    // specific request without redeploying: compression.filter's default
    // implementation only inspects Content-Type, not this header.
    if (req.headers['x-no-compression']) {
        return false;
    }
    if (res.getHeader('Content-Disposition')) {
        return false;
    }
    return compression.filter(req, res);
}

export function createCompressionMiddleware(): RequestHandler {
    return compression({
        threshold: 1024,
        filter: shouldCompressResponse,
    });
}
