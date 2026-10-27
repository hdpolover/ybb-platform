// services/api/src/modules/support/application/commands/handlers/create-support-ticket.handler.spec.ts
import { CreateSupportTicketHandler } from './create-support-ticket.handler';
import { CreateSupportTicketCommand } from '../create-support-ticket.command';

jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@shared/utils/resolve-active-program-contact', () => ({
    resolveActiveProgramContact: jest.fn().mockResolvedValue({ contactEmail: null }),
}));

/**
 * The client-sent programId must only be honoured when the participant has an
 * application in that program. Otherwise tickets get filed under whichever
 * edition the frontend happened to default to (ops ticket #129).
 */
describe('CreateSupportTicketHandler program resolution', () => {
    const OWNED = 'program-6th';
    const LATEST = 'program-latest';
    const FOREIGN = 'program-7th';

    function build() {
        const findFirst = jest.fn((args: { where: { programId?: string } }) => {
            if (args.where.programId) {
                return Promise.resolve(args.where.programId === OWNED ? { programId: OWNED } : null);
            }
            return Promise.resolve({ programId: LATEST });
        });
        const ticketCreate = jest.fn();
        const prisma = {
            participantApplication: { findFirst },
            user: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        const unitOfWork = {
            execute: jest.fn((fn: (repos: unknown) => Promise<void>) =>
                fn({ tx: { supportTicket: { create: ticketCreate }, supportTicketMessage: { create: jest.fn() } } }),
            ),
        };
        const handler = new CreateSupportTicketHandler(
            { generateTicketNumber: jest.fn().mockResolvedValue('T-1') } as never,
            { findByUserId: jest.fn().mockResolvedValue({ id: 'part-1', userId: 'user-1', fullName: 'P' }) } as never,
            unitOfWork as never,
            {
                classify: jest.fn().mockResolvedValue({ priority: 'medium', source: 'rule', model: null, confidence: 1, reason: '' }),
            } as never,
            { emit: jest.fn() } as never,
            prisma as never,
        );
        return { handler, ticketCreate, findFirst };
    }

    const run = (handler: CreateSupportTicketHandler, programId?: string) =>
        handler.execute(
            new CreateSupportTicketCommand('user-1', {
                category: 'general',
                subject: 's',
                description: 'd',
                programId,
            } as never),
        );

    it('keeps a programId the participant has an application in', async () => {
        const { handler, ticketCreate } = build();
        await run(handler, OWNED);
        expect(ticketCreate.mock.calls[0][0].data.programId).toBe(OWNED);
    });

    it('replaces a programId the participant has no application in with the latest application', async () => {
        const { handler, ticketCreate, findFirst } = build();
        await run(handler, FOREIGN);
        expect(ticketCreate.mock.calls[0][0].data.programId).toBe(LATEST);
        expect(findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ participantId: 'part-1', programId: FOREIGN, deletedAt: null }) }),
        );
    });

    it('uses the latest application when no programId is sent', async () => {
        const { handler, ticketCreate } = build();
        await run(handler, undefined);
        expect(ticketCreate.mock.calls[0][0].data.programId).toBe(LATEST);
    });
});
