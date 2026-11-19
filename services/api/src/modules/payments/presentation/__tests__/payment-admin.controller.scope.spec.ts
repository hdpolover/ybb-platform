// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.scope.spec.ts
//
// admin/payments carried only JwtAuthGuard + RolesGuard, so an admin scoped to
// one programme could list, read, download proofs for, verify, re-status,
// notify and re-send receipts for invoices of any programme in any brand, and
// edit the global payment-method master every programme falls back to.
//
// Driven against the REAL scope resolver (resolveRevenueAccessScope via
// getRequestAdminScope) with only Prisma mocked: the programme an invoice
// belongs to comes from the invoice row, never from the request.
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

const MINE = '11111111-1111-4111-8111-111111111111';
const THEIRS = '22222222-2222-4222-8222-222222222222';
const INVOICE_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const METHOD_ID = '33333333-3333-4333-8333-333333333333';

const USER: CurrentUserData = { userId: 'user-1', email: 'a@test.com', brandId: 'brand-1', role: [], adminId: 'admin-1' };

const ASSIGNED_ADMIN = {
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: null,
    role: null,
    adminBrands: [],
    adminPrograms: [{ programId: MINE, permissions: ['payments:write'] }],
};
const PLATFORM_ADMIN = { ...ASSIGNED_ADMIN, accessLevel: 5, adminPrograms: [] };
// In scope, but payments:read only (prod Digital Marketing / Program Admin).
const READ_ONLY_ADMIN = { ...ASSIGNED_ADMIN, adminPrograms: [{ programId: MINE, permissions: ['payments:read'] }] };
const withGrant = (permissions: string[]) => ({ ...ASSIGNED_ADMIN, adminPrograms: [{ programId: MINE, permissions }] });

async function build(opts: { admin: object; invoiceProgramIds?: string[] }) {
    const readPrisma = {
        admin: { findUnique: jest.fn().mockResolvedValue(opts.admin) },
        program: {
            findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
                Promise.resolve({ id: where.id, brandId: 'brand-x', name: 'p', deletedAt: null }),
            ),
        },
        // First downstream read of the programme-level invoice routes.
        $queryRaw: jest.fn().mockRejectedValue(new Error('reached')),
    };
    // Every primary read/write is a "reached the route body" probe.
    // The scope check reads invoice ownership from the primary too; route it to
    // its own mock so the route-body findMany stays a clean "reached" probe.
    const scopeLookup = jest.fn().mockResolvedValue(
        (opts.invoiceProgramIds ?? []).map((programId) => ({ application: { programId } })),
    );
    const bodyFindMany = jest.fn().mockRejectedValue(new Error('reached'));
    const prisma = {
        applicationInvoice: {
            findUnique: jest.fn().mockRejectedValue(new Error('reached')),
            // Scope lookup selects only application.programId; route bodies also select id.
            findMany: jest.fn((args?: { select?: { id?: unknown; application?: unknown } }) =>
                args?.select?.application && !args.select.id ? scopeLookup(args) : bodyFindMany(args),
            ),
        },
    };
    const paymentServiceClient = {
        get: jest.fn().mockRejectedValue(new Error('reached')),
        post: jest.fn().mockRejectedValue(new Error('reached')),
        put: jest.fn().mockRejectedValue(new Error('reached')),
        delete: jest.fn().mockRejectedValue(new Error('reached')),
    };
    const cacheService = { get: jest.fn().mockRejectedValue(new Error('reached')) };

    const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentAdminController],
        providers: [
            { provide: PaymentServiceHttpClient, useValue: paymentServiceClient },
            { provide: PaymentGatewayClient, useValue: {} },
            { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            { provide: FileServiceClient, useValue: {} },
            { provide: CacheService, useValue: cacheService },
            { provide: PrismaService, useValue: prisma },
            { provide: PrismaReadService, useValue: readPrisma },
            { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
        ],
    })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

    return {
        controller: module.get(PaymentAdminController),
        readPrisma,
        prisma,
        scopeLookup,
        bodyFindMany,
        paymentServiceClient,
        cacheService,
    };
}

type Built = Awaited<ReturnType<typeof build>>;

// programme-keyed routes: the programme id IS the target.
const programRoutes: Array<{ name: string; call: (b: Built, programId: string) => Promise<unknown>; probe: (b: Built) => jest.Mock }> = [
    { name: 'GET invoices', call: (b, p) => b.controller.listInvoices({ programId: p }, USER), probe: (b) => b.readPrisma.$queryRaw },
    { name: 'GET by-country', call: (b, p) => b.controller.getPaymentsByCountry(p, USER), probe: (b) => b.readPrisma.$queryRaw },
    { name: 'GET programs/:programId/methods', call: (b, p) => b.controller.listProgramMethods(p, USER), probe: (b) => b.cacheService.get },
    {
        name: 'PUT programs/:programId/methods/:methodId',
        call: (b, p) => b.controller.upsertProgramMethod(p, METHOD_ID, {} as never, USER),
        probe: (b) => b.paymentServiceClient.put,
    },
    {
        name: 'PUT programs/:programId/methods',
        call: (b, p) => b.controller.bulkUpsertProgramMethods(p, {} as never, USER),
        probe: (b) => b.paymentServiceClient.put,
    },
];

// invoice-keyed routes: the programme is resolved invoice -> application -> programId.
const invoiceRoutes: Array<{ name: string; call: (b: Built) => Promise<unknown>; probe: (b: Built) => jest.Mock }> = [
    { name: 'GET invoices/:id', call: (b) => b.controller.getInvoice(INVOICE_ID, USER), probe: (b) => b.prisma.applicationInvoice.findUnique },
    {
        name: 'GET invoices/:id/proof',
        call: (b) => b.controller.downloadInvoiceProof(INVOICE_ID, {} as never, USER),
        probe: (b) => b.prisma.applicationInvoice.findUnique,
    },
    {
        name: 'POST invoices/:id/verify',
        call: (b) => b.controller.verifyInvoice(INVOICE_ID, { action: 'approve' }, USER),
        probe: (b) => b.prisma.applicationInvoice.findUnique,
    },
    {
        name: 'PATCH invoices/:id/status',
        call: (b) => b.controller.updateInvoiceStatus(INVOICE_ID, { status: PaymentStatus.paid }, USER),
        probe: (b) => b.prisma.applicationInvoice.findUnique,
    },
    {
        name: 'POST notify-payment-issue',
        call: (b) => b.controller.notifyPaymentIssue({ invoiceIds: [INVOICE_ID] }, USER),
        probe: (b) => b.bodyFindMany,
    },
    {
        name: 'POST resend-receipt',
        call: (b) => b.controller.resendReceipt({ invoiceId: INVOICE_ID }, USER),
        probe: (b) => b.prisma.applicationInvoice.findUnique,
    },
];

const globalMethodRoutes: Array<{ name: string; call: (b: Built) => Promise<unknown>; probe: (b: Built) => jest.Mock }> = [
    { name: 'POST methods', call: (b) => b.controller.createMethod({} as never, USER), probe: (b) => b.paymentServiceClient.post },
    { name: 'PUT methods/:id', call: (b) => b.controller.updateMethod(METHOD_ID, {} as never, USER), probe: (b) => b.paymentServiceClient.put },
    { name: 'DELETE methods/:id', call: (b) => b.controller.deleteMethod(METHOD_ID, USER), probe: (b) => b.paymentServiceClient.delete },
];

describe('admin/payments programme-keyed routes are scoped', () => {
    it.each(programRoutes)('$name: 404 for a programme the admin does not hold', async ({ call, probe }) => {
        const b = await build({ admin: ASSIGNED_ADMIN });
        await expect(call(b, THEIRS)).rejects.toBeInstanceOf(NotFoundException);
        expect(probe(b)).not.toHaveBeenCalled();
    });

    it.each(programRoutes)('$name: passes for the admin\'s own programme', async ({ call, probe }) => {
        const b = await build({ admin: ASSIGNED_ADMIN });
        await call(b, MINE).catch(() => undefined);
        expect(probe(b)).toHaveBeenCalled();
    });
});

describe('admin/payments invoice-keyed routes are scoped to the invoice\'s programme', () => {
    it.each(invoiceRoutes)('$name: 404 when the invoice belongs to another programme', async ({ call, probe }) => {
        const b = await build({ admin: ASSIGNED_ADMIN, invoiceProgramIds: [THEIRS] });
        await expect(call(b)).rejects.toThrow(new NotFoundException('Invoice not found'));
        expect(probe(b)).not.toHaveBeenCalled();
        // Nothing reaches the Go payment service either.
        expect(b.paymentServiceClient.post).not.toHaveBeenCalled();
        expect(b.paymentServiceClient.get).not.toHaveBeenCalled();
    });

    it.each(invoiceRoutes)('$name: passes when the invoice is in the admin\'s programme', async ({ call, probe }) => {
        const b = await build({ admin: ASSIGNED_ADMIN, invoiceProgramIds: [MINE] });
        await call(b).catch(() => undefined);
        expect(probe(b)).toHaveBeenCalled();
    });

    it('notify-payment-issue refuses the whole batch if any invoice is out of scope', async () => {
        const b = await build({ admin: ASSIGNED_ADMIN, invoiceProgramIds: [MINE, THEIRS] });
        await expect(
            b.controller.notifyPaymentIssue({ invoiceIds: [INVOICE_ID, METHOD_ID] }, USER),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(b.bodyFindMany).not.toHaveBeenCalled();
    });

    it('platform admins skip the lookup entirely', async () => {
        const b = await build({ admin: PLATFORM_ADMIN, invoiceProgramIds: [THEIRS] });
        await b.controller.getInvoice(INVOICE_ID, USER).catch(() => undefined);
        expect(b.scopeLookup).not.toHaveBeenCalled();
        expect(b.prisma.applicationInvoice.findUnique).toHaveBeenCalled();
    });
});

describe('admin/payments global payment-method master is platform-only', () => {
    it.each(globalMethodRoutes)('$name: 403 for a programme-scoped admin', async ({ call, probe }) => {
        const b = await build({ admin: ASSIGNED_ADMIN });
        await expect(call(b)).rejects.toBeInstanceOf(ForbiddenException);
        expect(probe(b)).not.toHaveBeenCalled();
    });

    it.each(globalMethodRoutes)('$name: passes for a platform admin', async ({ call, probe }) => {
        const b = await build({ admin: PLATFORM_ADMIN });
        await call(b).catch(() => undefined);
        expect(probe(b)).toHaveBeenCalled();
    });
});

const WRITE_INVOICE_ROUTES = new Set(['POST invoices/:id/verify', 'PATCH invoices/:id/status', 'POST notify-payment-issue', 'POST resend-receipt']);
const invoiceWriteRoutes = invoiceRoutes.filter((route) => WRITE_INVOICE_ROUTES.has(route.name));
const programWriteRoutes = programRoutes.filter((route) => route.name.startsWith('PUT '));

describe('admin/payments write routes require a write permission on the programme', () => {
    it.each(invoiceWriteRoutes)('$name: 403 for an in-scope admin with payments:read only', async ({ call, probe }) => {
        const b = await build({ admin: READ_ONLY_ADMIN, invoiceProgramIds: [MINE] });
        await expect(call(b)).rejects.toBeInstanceOf(ForbiddenException);
        expect(probe(b)).not.toHaveBeenCalled();
        expect(b.paymentServiceClient.post).not.toHaveBeenCalled();
    });

    it.each(programWriteRoutes)('$name: 403 for an in-scope admin with payments:read only', async ({ call, probe }) => {
        const b = await build({ admin: READ_ONLY_ADMIN });
        await expect(call(b, MINE)).rejects.toBeInstanceOf(ForbiddenException);
        expect(probe(b)).not.toHaveBeenCalled();
    });

    it.each(programWriteRoutes)('$name: program:write also passes (method overlay is programme config)', async ({ call, probe }) => {
        const b = await build({ admin: withGrant(['program:write']) });
        await call(b, MINE).catch(() => undefined);
        expect(probe(b)).toHaveBeenCalled();
    });

    it('resend-receipt also passes on support:write', async () => {
        const b = await build({ admin: withGrant(['support:write']), invoiceProgramIds: [MINE] });
        await b.controller.resendReceipt({ invoiceId: INVOICE_ID }, USER).catch(() => undefined);
        expect(b.prisma.applicationInvoice.findUnique).toHaveBeenCalled();
    });

    it('resend-receipt and notify-payment-issue also pass on program:write', async () => {
        const b = await build({ admin: withGrant(['program:write']), invoiceProgramIds: [MINE] });
        await b.controller.resendReceipt({ invoiceId: INVOICE_ID }, USER).catch(() => undefined);
        await b.controller.notifyPaymentIssue({ invoiceIds: [INVOICE_ID] }, USER).catch(() => undefined);
        expect(b.prisma.applicationInvoice.findUnique).toHaveBeenCalled();
        expect(b.bodyFindMany).toHaveBeenCalled();
    });

    it('notify-payment-issue also passes on support:write (a payment-help email is a support reply)', async () => {
        const b = await build({ admin: withGrant(['support:write']), invoiceProgramIds: [MINE] });
        await b.controller.notifyPaymentIssue({ invoiceIds: [INVOICE_ID] }, USER).catch(() => undefined);
        expect(b.bodyFindMany).toHaveBeenCalled();
    });

    it.each(invoiceWriteRoutes)('$name: a platform admin without the permission passes', async ({ call, probe }) => {
        const b = await build({ admin: PLATFORM_ADMIN, invoiceProgramIds: [THEIRS] });
        await call(b).catch(() => undefined);
        expect(probe(b)).toHaveBeenCalled();
    });

    it('read routes stay open to payments:read', async () => {
        const b = await build({ admin: READ_ONLY_ADMIN, invoiceProgramIds: [MINE] });
        await b.controller.getInvoice(INVOICE_ID, USER).catch(() => undefined);
        expect(b.prisma.applicationInvoice.findUnique).toHaveBeenCalled();
    });
});
